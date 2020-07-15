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
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.HashSet;
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

  /*
   * Called when a client submits a GET request to the /data URL
   */
  @Override
  public void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
    response.setContentType("application/json");
    String depthParam = request.getParameter("depth");
    if (depthParam == null) {
      String error = "Improper depth parameter, cannot generate graph";
      response.setHeader("serverError", error);
      return;
    }

    int depthNumber = Integer.parseInt(depthParam);
    boolean success = true; // Innocent until proven guilty; successful until proven a failure

    // Initialize variables if any are null. Ideally should all be null or none
    // should be null
    if (currDataGraph == null && originalDataGraph == null) {

      /*
       * The below code is used to read a graph specified in textproto form
       */
      InputStreamReader graphReader =
          new InputStreamReader(
              getServletContext().getResourceAsStream("/WEB-INF/graph.textproto"));
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

      currDataGraph = DataGraph.create();
      success = currDataGraph.graphFromProtoNodes(protoNodesMap);
      if (!success) {
        response.setHeader("serverError", error);
        return;
      }
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
              getServletContext().getResourceAsStream("/WEB-INF/mutation.textproto"));
      MutationList.Builder mutBuilder = MutationList.newBuilder();
      TextFormat.merge(mutReader, mutBuilder);
      List<Mutation> mutList = mutBuilder.build().getMutationList();

      // Only apply mutations once
      for (Mutation mut : mutList) {
        success = currDataGraph.mutateGraph(mut);
        if (!success) {
          String error = "Failed to apply mutation " + mut.toString() + " to graph";
          response.setHeader("serverError", error);
          return;
        }
      }
    }

    MutableGraph<GraphNode> truncatedGraph = currDataGraph.getGraphWithMaxDepth(depthNumber);
    String graphJson = Utility.graphToJson(truncatedGraph);
    response.getWriter().println(graphJson);
  }
}
