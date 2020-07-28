// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.google.sps;

import com.google.common.collect.Sets;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.io.InputStreamReader;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.HashMap;
import java.util.HashSet;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.common.graph.MutableGraph;
import com.google.protobuf.TextFormat;
import com.proto.GraphProtos.Graph;
import com.proto.GraphProtos.Node;
import com.proto.MutationProtos.MultiMutation;
import com.proto.MutationProtos.MutationList;

@WebServlet("/data")
public class DataServlet extends HttpServlet {

  private DataGraph currDataGraph = null;
  private DataGraph originalDataGraph = null;
  private List<MultiMutation> mutList = null;

  // A list containing the indices of mutations that mutate the node we are
  // currently filtering by. It is initialized to all indices since we start
  // out not filtering by anything.
  List<Integer> filteredMutationIndices = new ArrayList<>();

  // A list containing all integers from 0 to mutList.size() - 1
  List<Integer> defaultIndices = new ArrayList<>();

  // A map from each node name to a list of indices in mutList where
  // that node is mutated. In addition, the empty string is mapped
  // to the list [0, mutList.size() - 1].
  HashMap<String, List<Integer>> mutationIndicesMap = new HashMap<>();

  /*
   * Called when a client submits a GET request to the /data URL
   */
  @Override
  public void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
    boolean success = true;

    /*
     *********************************
     * Initialize Graph Variables
     *********************************
     */
    if (currDataGraph == null && originalDataGraph == null) {
      success =
          initializeGraphVariables(
              getServletContext().getResourceAsStream("/WEB-INF/graph.textproto"));
      if (!success) {
        response.setHeader(
            "serverError", "Failed to parse input graph into Guava graph - not a DAG!");
        return;
      }
      currDataGraph = originalDataGraph.getCopy();
    } else if (currDataGraph == null || originalDataGraph == null) {
      response.setHeader("serverError", "Invalid input");
      return;
    }

    /*
     *************************************
     * Initialize Mutation List Variables
     *************************************
     */
    if (mutList == null) {
      initializeMutationVariables(
          getServletContext().getResourceAsStream("/WEB-INF/mutation.textproto"));
      // Populate the list of all possible mutation indices
      defaultIndices = IntStream.range(0, mutList.size()).boxed().collect(Collectors.toList());
      // and store this as the list of relevant indices for filtering by empty string
      // (= not filtering)
      mutationIndicesMap.put("", defaultIndices);
    }

    /*
     *************************************
     * Read Request Parameters
     *************************************
     */

    String depthParam = request.getParameter("depth");
    String mutationParam = request.getParameter("mutationNum");
    String nodeNameParam = request.getParameter("nodeName");
    String tokenParam = request.getParameter("tokenName");

    if (depthParam == null) {
      String error = "Improper depth parameter, cannot generate graph";
      response.setHeader("serverError", error);
      return;
    } else if (mutationParam == null) {
      String error = "Improper mutation number parameter, cannot generate graph";
      response.setHeader("serverError", error);
      return;
    }
    // If nodeNameParam or tokenParam are null, we should just set them to empty and
    // not error out
    if (nodeNameParam == null) {
      nodeNameParam = "";
    }
    if (tokenParam == null) {
      tokenParam = "";
    }
    int depthNumber = Integer.parseInt(depthParam);
    int mutationNumber = Integer.parseInt(mutationParam);

    // Truncated version of graph to return to the client
    MutableGraph<GraphNode> truncatedGraph;

    // The list of mutations that need to be applied to the nodes in currDataGraph
    // to get the requested graph, filtered to only contain changes pertaining
    // to nodes in the truncated graph or the filtered node (null if the graph
    // requested is before the current graph in the sequence of mutations)
    MultiMutation diff = null;
    MultiMutation filteredDiff = null;

    response.setContentType("application/json");
    String graphJson;

    /*
     *************************************************
     * Filtering Graph and Mutations By Searched Node
     *************************************************
     */

    // Get the diff if we are going forward in the list of mutations
    if (mutationNumber > currDataGraph.numMutations()) {
      diff = Utility.getMultiMutationAtIndex(mutList, mutationNumber);
    }

    // A list of "roots" to return nodes at most depth radius from
    HashSet<String> queried = new HashSet<>();
    // We start by adding the node name if it was searched for
    if (nodeNameParam.length() > 0) {
      queried.add(nodeNameParam);
    }

    // Show mutations relevant to nodes that contain the token in the current graph
    if (currDataGraph.tokenMap().containsKey(tokenParam)) {
      queried.addAll(currDataGraph.tokenMap().get(tokenParam));
    }

    // Get the graph at the requested mutation number
    try {
      currDataGraph =
          Utility.getGraphAtMutationNumber(
              originalDataGraph, currDataGraph, mutationNumber, mutList);
    } catch (IllegalArgumentException e) {
      response.setHeader("serverError", e.getMessage());
      return;
    }
    // Show mutations relevant to nodes that contain the token in the new graph
    if (currDataGraph.tokenMap().containsKey(tokenParam)) {
      queried.addAll(currDataGraph.tokenMap().get(tokenParam));
    }

    // Truncate the graph from the nodes that the client had searched for
    truncatedGraph = currDataGraph.getReachableNodes(queried, depthNumber);

    // If we are not filtering the graph or limiting its depth, show all mutations of all nodes
    if (nodeNameParam.length() == 0
        && tokenParam.length() == 0
        && truncatedGraph.equals(currDataGraph.graph())) {
      filteredMutationIndices = defaultIndices;
      filteredDiff = diff;
    } else {
      // Get the names of all the displayed nodes and find all indices of mutations
      // that mutate any of them
      Set<String> truncatedGraphNodeNames = Utility.getNodeNamesInGraph(truncatedGraph);
      // Also get mutations relevant to the searched node if it is not an empty string
      if (nodeNameParam.length() != 0) {
        truncatedGraphNodeNames.add(nodeNameParam);
      }

      // A set containing a indices where nodes currently displayed on the graph
      // or queried are mutated
      Set<Integer> mutationIndicesSet = new HashSet<>();
      mutationIndicesSet.addAll(
          Utility.findRelevantMutationsSet(truncatedGraphNodeNames, mutationIndicesMap, mutList));
      mutationIndicesSet.addAll(Utility.getMutationIndicesOfTokenSet(tokenParam, mutList));
      filteredMutationIndices = new ArrayList<>(mutationIndicesSet);
      Collections.sort(filteredMutationIndices);

      if (tokenParam.length() == 0) {
        filteredDiff = Utility.filterMultiMutationByNodes(diff, truncatedGraphNodeNames);
      } else {
        // In this case, also show mutations relevant to nodes that used to have the token but
        // might not exist anymore
        filteredDiff =
            Utility.filterMultiMutationByNodes(diff, Sets.union(truncatedGraphNodeNames, queried));
      }
    }
    // We set the headers in the following 4 scenarios:
    // The searched node is not in the graph and is never mutated
    if (truncatedGraph.nodes().size() == 0 && filteredMutationIndices.size() == 0) {
      response.setHeader(
          "serverError", "The searched node does not exist anywhere in this graph or in mutations");
      return;
    }
    // The searched node is not in the graph but is mutated at some past/future
    // point. The diff conditions are included to prevent entry into this case
    // when the searched node is deleted for example. The diff being non-empty
    // means that there is some mutation pertaining to the searched node to show
    if (truncatedGraph.nodes().size() == 0
        && filteredMutationIndices.size() != 0
        && filteredMutationIndices.indexOf(mutationNumber) == -1) {
      response.setHeader(
          "serverMessage",
          "The searched node/token does not exist in this graph, so nothing is shown. However, it"
              + " is mutated at some other step. Please click next or previous to navigate to a"
              + " graph where this node exists.");
    }
    // The searched node exists but is not mutated in the current graph
    if (truncatedGraph.nodes().size() != 0
        && !(mutationNumber == -1 && nodeNameParam.equals("") && tokenParam.equals(""))
        && filteredMutationIndices.indexOf(mutationNumber) == -1
        && (diff == null || diff.getMutationList().size() == 0)) {
      response.setHeader(
          "serverMessage",
          "The searched node/token exists in this graph. However, it is not mutated in this"
              + " graph. Please click next or previous if you wish to see where it was"
              + " mutated!");
    }

    // There is a diff between the previously-displayed graph and the current graph but
    // no mutations in it only mutate on-screen nodes
    if (filteredMutationIndices.indexOf(mutationNumber) != -1
        && filteredDiff != null
        && filteredDiff.getMutationList().size() == 0) {
      response.setHeader(
          "serverMessage",
          "The desired set of nodes is mutated in this graph but your other parameters (for"
              + " eg.depth or filter), limit the display of the mutations. Please try increasing "
              + " your radius or clearing your filter to view the mutation.");
    }
    graphJson =
        Utility.graphToJson(
            truncatedGraph, filteredMutationIndices, filteredDiff, mutList.size(), queried);
    response.getWriter().println(graphJson);
  }

  /**
   * Private function to intitialize graph variables. Returns a boolean to represent whether the
   * InpuStream was read successfully.
   *
   * @param graphInput InputStream to initialize graph variables over
   * @return whether variables were initialized properly; true if successful and false otherwise
   * @throws IOException if something goes wrong during the reading
   */
  private boolean initializeGraphVariables(InputStream graphInput) throws IOException {
    InputStreamReader graphReader = new InputStreamReader(graphInput);
    Graph.Builder graphBuilder = Graph.newBuilder();
    TextFormat.merge(graphReader, graphBuilder);
    Graph protoGraph = graphBuilder.build();

    Map<String, Node> protoNodesMap = protoGraph.getNodesMapMap();
    originalDataGraph = DataGraph.create();
    return originalDataGraph.graphFromProtoNodes(protoNodesMap);
  }

  /**
   * Private function to intialize the mutation list.
   *
   * @param mutationInput InputStream to initialize variable over
   * @throws IOException if something goes wrong during the reading
   */
  private void initializeMutationVariables(InputStream mutationInput) throws IOException {
    InputStreamReader mutReader = new InputStreamReader(mutationInput);
    MutationList.Builder mutBuilder = MutationList.newBuilder();
    TextFormat.merge(mutReader, mutBuilder);
    mutList = mutBuilder.build().getMutationList();
  }
}
