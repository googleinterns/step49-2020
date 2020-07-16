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

import java.io.IOException;
import java.util.ArrayList;

import java.io.InputStreamReader;

import java.util.List;
import java.util.Map;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.common.graph.MutableGraph;
import com.google.protobuf.TextFormat;
import com.proto.GraphProtos.Graph;
import com.proto.GraphProtos.Node;
import com.proto.MutationProtos.Mutation;
import com.proto.MutationProtos.MutationList;

@WebServlet("/data")
public class DataServlet extends HttpServlet {

  private List<Mutation> mutList = null;

  private DataGraph currDataGraph = null;
  private DataGraph originalDataGraph = null;

  List<Integer> relevantMutationIndices = new ArrayList<>(); // should originally be everything
  List<Integer> defaultIndices = new ArrayList<>();

  int oldNumMutations = 0;
  String lastNodeName = "";

  /*
   * Called when a client submits a GET request to the /data URL
   */
  @Override
  public void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
    response.setContentType("application/json");
    String depthParam = request.getParameter("depth");
    String mutationParam = request.getParameter("mutationNum");
    if (depthParam == null) {
      String error = "Improper depth parameter, cannot generate graph";
      response.setHeader("serverError", error);
      return;
    } else if (mutationParam == null) {
      String error = "Improper mutation number parameter, cannot generate graph";
      response.setHeader("serverError", error);
      return;
    }

    int depthNumber = Integer.parseInt(depthParam);
    int mutationNumber = Integer.parseInt(mutationParam);

    boolean success = true; // Innocent until proven guilty; successful until proven a failure

    // Initialize variables if any are null. Ideally should all be null or none
    // should be null
    if (currDataGraph == null && originalDataGraph == null) {

      /*
       * The below code is used to read a graph specified in textproto form
       */
      InputStreamReader graphReader =
          new InputStreamReader(
              getServletContext().getResourceAsStream("/WEB-INF/initial_graph.textproto"));
      Graph.Builder graphBuilder = Graph.newBuilder();
      TextFormat.merge(graphReader, graphBuilder);
      Graph protoGraph = graphBuilder.build();

      Map<String, Node> protoNodesMap = protoGraph.getNodesMapMap();
      // Originally both set to same data
      originalDataGraph = DataGraph.create();
      success = originalDataGraph.graphFromProtoNodes(protoNodesMap);
      String error = "Failed to parse input graph into Guava graph - not a DAG!";
      if (!success) {
        response.setHeader("serverError", error);
        return;
      }
      currDataGraph = originalDataGraph.getCopy();
    } else if (currDataGraph == null || originalDataGraph == null) {
      String error = "Invalid input";
      response.setHeader("serverError", error);
      return;
    }

    // Mutations file hasn't been read yet
    if (mutList == null) {
      /*
       * The below code is used to read a mutation list specified in textproto form
       */
      InputStreamReader mutReader =
          new InputStreamReader(
              getServletContext().getResourceAsStream("/WEB-INF/mutations.textproto"));
      MutationList.Builder mutBuilder = MutationList.newBuilder();
      TextFormat.merge(mutReader, mutBuilder);
      mutList = mutBuilder.build().getMutationList();

      // initially, all mutation indices are relevant so we put that into the default
      // and set them equal.
      relevantMutationIndices = new ArrayList<>();
      for (int i = 0; i < mutList.size(); i++) {
        defaultIndices.add(i);
      }
      // Relevant mutation indicies start as everything
      relevantMutationIndices = defaultIndices;
    }

    // Parameter for the nodeName the user searched for in the frontend
    String nodeNameParam = request.getParameter("nodeName");

    // At this point, currDataGraph is basically Utility.getGraphAtMutationNumber(originalDataGraph,
    // currDataGraph, oldNumMutations, mutList);

    // returns null if either mutation isn't able to be applied or if num < 0
    if (currDataGraph == null) {
      String error = "Failed to apply mutations!";
      response.setHeader("serverError", error);
      return;
    }

    // Truncated version of the graph and mutation list, for returning to the client
    MutableGraph<GraphNode> truncatedGraph;

    // No node is searched, so use the whole graph
    if (nodeNameParam == null || nodeNameParam.length() == 0) {
      // Just get the specified deptg, the mutation list, and relevant mutations as
      // they are
      currDataGraph =
          Utility.getGraphAtMutationNumber(
              originalDataGraph, currDataGraph, mutationNumber, mutList);
      truncatedGraph = currDataGraph.getGraphWithMaxDepth(depthNumber);
      relevantMutationIndices = defaultIndices;
    } else { // A node is searched

      // CASES:
      // 1. Node isn't on the current graph, node isn't in any mutations -> error (not fatal)
      // 2. Node is not on the current graph, in a mutation though -> say it's not
      // here, jump to the mutation with it
      // this should only apply when a new node is searched
      // 3. Node is on the current graph -> then display current graph WITH the
      // relevant indices (no need to change indices)
      // Could either be the same node or a different node

      // Indicies of relevant mutations from the entire mutList
      relevantMutationIndices = Utility.getMutationIndicesOfNode(nodeNameParam, mutList);

      // case 1: Node is not in the current graph or any graph
      if (!currDataGraph.graphNodesMap().containsKey(nodeNameParam)
          && relevantMutationIndices.isEmpty()) {
        String error = "There are no nodes anywhere on this graph!";
        response.setHeader("serverError", error);
        return;
      }
      // case 2: Node is not in the current graph
      if (!currDataGraph.graphNodesMap().containsKey(nodeNameParam)) {

        // index of the next element in relevantMutationsIndices that is greater than
        // oldNumMutations
        int newNumIndex = Utility.getNextGreatestNumIndex(relevantMutationIndices, oldNumMutations);

        // shouldn't happen, but we're back to case 1.
        if (newNumIndex == -1) {
          String error = "There are no nodes anywhere on this graph!";
          response.setHeader("serverError", error);
          return;
        }
        // The index of the next mutation to look at in the ORIGINAL mutlist
        int newNum = relevantMutationIndices.get(newNumIndex);

        // only get the indices AFTER this one
        relevantMutationIndices =
            relevantMutationIndices.subList(newNumIndex, relevantMutationIndices.size());
        relevantMutationIndices.add(0, oldNumMutations);

        // Update the current graph
        currDataGraph =
            Utility.getGraphAtMutationNumber(originalDataGraph, currDataGraph, newNum, mutList);

        // Add null check?
        oldNumMutations = newNum;
        lastNodeName = nodeNameParam;
      } else {
        // case 3: node is in the current graph. then relevant mutationIndices is ok
        currDataGraph =
            Utility.getGraphAtMutationNumber(
                originalDataGraph, currDataGraph, mutationNumber, mutList);
        oldNumMutations = mutationNumber;
      }
      // This is the single search
      truncatedGraph = currDataGraph.getReachableNodes(nodeNameParam, depthNumber);
    }

    String graphJson =
        Utility.graphToJson(
            truncatedGraph, relevantMutationIndices.size(), relevantMutationIndices);
    response.getWriter().println(graphJson);
  }
}
