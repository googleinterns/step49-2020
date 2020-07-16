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

/**
 * Submits a fetch request to the /data url. Upon receiving a JSON encoding of the
 * nodes and edges of the graph, renders the graph in a container on the page using
 * the cytoscape.js library
 */

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import popper from 'cytoscape-popper';
import tippy, { sticky } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/dist/backdrop.css';
import 'tippy.js/animations/shift-away.css';

export { searchNode, initializeNumMutations, setCurrGraphNum, initializeTippy, generateGraph, getUrl, navigateGraph, currGraphNum, numMutations, updateButtons, highlightDiff, initializeReasonTooltip, getGraphDisplay };

cytoscape.use(popper); // register extension
cytoscape.use(dagre); // register extension

// Stores the index of the graph (in sequence of mutations) currently
// displayed on the screen. Must be >= 0.
let currGraphNum = 0;
// Stores the number of mutations in the list this graph is applying
// The user cannot click next to a graph beyond this point
let numMutations = 0;

/**
 * Initializes the number of mutations
 */
function initializeNumMutations(num) {
  numMutations = num;
}

/**
 * Sets the current graph number
 */
function setCurrGraphNum(num) {
  currGraphNum = num;
}

/**
 * Submits a fetch request to the /data URL to retrieve the graph
 * and then displays it on the page
 */
async function generateGraph() {
  // Arrays to store the cytoscape graph node and edge objects
  let graphNodes = [];
  let graphEdges = [];

  // disable buttons
  const prevBtn = document.getElementById("prevbutton");
  const nextBtn = document.getElementById("nextbutton");
  prevBtn.disabled = true;
  nextBtn.disabled = true;

  const url = getUrl();

  prevBtn.disabled = true;
  nextBtn.disabled = true;

  const response = await fetch(url);

  const serverErrorStatus = response.headers.get("serverError");

  // Error on server side
  if (serverErrorStatus !== null) {
    displayError(serverErrorStatus);
    return;
  }

  const jsonResponse = await response.json();
  // Graph nodes and edges received from server
  const nodes = JSON.parse(jsonResponse.nodes);
  const edges = JSON.parse(jsonResponse.edges);
  initializeNumMutations(JSON.parse(jsonResponse.numMutations));
  const mutList = jsonResponse["mutationDiff"].length === 0 ? null : JSON.parse(jsonResponse["mutationDiff"]);
  const reason = jsonResponse["reason"].length === 0 ? "" : jsonResponse["reason"];

  if (!nodes || !edges || !Array.isArray(nodes) || !Array.isArray(edges)) {
    displayError("Malformed graph received from server - edges or nodes are empty");
    return;
  }

  if (nodes.length === 0) {
    displayError("Nothing to display!");
    return;
  }

  // Add node to array of cytoscape nodes
  nodes.forEach(node =>
    graphNodes.push({
      group: "nodes",
      data: { id: node["name"], metadata: node["metadata"], tokens: node["tokenList"] }
    }))
  // and edge to array of cytoscape edges
  edges.forEach(edge => {
    const start = edge["nodeU"]["name"];
    const end = edge["nodeV"]["name"];
    graphEdges.push({
      group: "edges",
      data: {
        id: `edge${start}${end}`,
        target: end,
        source: start
      }
    });
  })
  getGraphDisplay(graphNodes, graphEdges, mutList, reason);
  updateButtons();
  return;
}

/**
 * Returns the url string given the user input
 * Ensures that the depth is an integer between 0 and 20
 */
function getUrl() {
  const depthElem = document.getElementById('num-layers');
  let selectedDepth = 0;
  if (depthElem === null) {
    selectedDepth = 3;
  }
  else {
    selectedDepth = depthElem.value
    if (selectedDepth.length === 0) {
      selectedDepth = 3;
    } else if (!Number.isInteger(selectedDepth)) {
      selectedDepth = Math.round(selectedDepth);
    }
    if (selectedDepth < 0) { // Extra validation for bounds
      selectedDepth = 0;
    } else if (selectedDepth > 20) {
      selectedDepth = 20;
    }
  }
  const url = `/data?depth=${selectedDepth}&mutationNum=${currGraphNum}`;
  return url;
}
/**
 * Takes an error message and creates a text element on the page to display this message
 */
function displayError(errorMsg) {
  // Create text to display the error
  const errorText = document.createElement("p");
  errorText.innerText = errorMsg;
  errorText.id = "errortext";

  const graphDiv = document.getElementById("graph");
  while (graphDiv.lastChild) {
    graphDiv.removeChild(graphDiv.lastChild);
  }
  graphDiv.appendChild(errorText);
  return;
}

/**
 * Takes in graph nodes and edges and creates a cytoscape graph with this
 * data. Assumes that the graph is a DAG to display it in the optimal layout.
 * Returns the cytoscape graph object.
 */
function getGraphDisplay(graphNodes, graphEdges, mutDiff, reason) {
  const cy = cytoscape({
    container: document.getElementById("graph"),
    elements: {
      nodes: graphNodes,
      edges: graphEdges
    },
    style: [
      {
        selector: 'node',
        style: {
          width: '50px',
          height: '50px',
          'background-color': 'blue',
          'label': 'data(id)',
          'color': 'white',
          'font-size': '20px',
          'text-halign': 'center',
          'text-valign': 'center',
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      }],
    layout: {
      name: 'dagre'
    },
    zoom: 0.75,
    pan: { x: 0, y: 0 },
    minZoom: .25,
    maxZoom: 2.5
  });

  // Initialize content of node's token list popup
  cy.nodes().forEach(node => initializeTippy(node));

  // When the user clicks on a node, display the token list tooltip for the node
  cy.on('tap', 'node', function (evt) {
    const node = evt.target;
    node.tip.show();
  });

  const searchElement = document.getElementById('search');
  document.getElementById('search-button').onclick = function () {
    if (searchNode(cy, searchElement.value) || searchElement.value == "") {
      document.getElementById('search-error').innerText = "";
    } else {
      document.getElementById('search-error').innerText = "Node does not exist.";
    }
  };

  // When a new graph is loaded, mutations are always shown by default
  const showMutButton = document.getElementById("show-mutations");
  showMutButton.checked = true;

  // Get the objects that will be modified by this mutation
  const result = highlightDiff(cy, mutDiff, reason);
  // Break it down into individual constituents
  const [deletedNodes, deletedEdges, addedNodes, addedEdges, modifiedNodes] = result;
  let elems = cy.collection();
  result.forEach(item => { elems = elems.union(item); })

  // Reposition added elements
  cy.layout({
    name: 'dagre'
  }).run();

  // Zoom in on them and activate their reason tooltips
  makeInteractiveAndFocus(cy, elems);


  showMutButton.addEventListener("change", () => {
    if (showMutButton.checked) {
      /*
       * We take advantage of the efficiency of batch operations to avoid calling
       * highlightDiff again each time the checkbox is clicked
       */
      showDiffs(cy, elems, deletedNodes, deletedEdges, addedNodes, addedEdges, modifiedNodes);
    } else {
      hideDiffs(cy, elems, deletedNodes, deletedEdges, addedNodes, addedEdges, modifiedNodes);
    }
  });
  return cy;
}


/**
 * Highlights modified nodes and edges in the graph according to the list
 * of mutations
 * 
 * @param {*} cy the graph 
 * @param {*} mutList the list of mutations to highlight
 * @param {*} reason the reason for the mutations
 * @returns {*} an array containing in order the deleted nodes, deleted edges, added
 * nodes, added edges and modified nodes as per the mutationList
 */
function highlightDiff(cy, mutList, reason = "") {
  // Initialize empty collections
  let deletedNodes = cy.collection();
  let deletedEdges = cy.collection();
  let addedNodes = cy.collection();
  let addedEdges = cy.collection();
  let modifiedNodes = cy.collection();

  // If the mutation list is empty
  if (!mutList) {
    return [deletedNodes, deletedEdges, addedNodes, addedEdges, modifiedNodes];
  }
  // Apply each mutation
  mutList.forEach(mutation => {
    const type = mutation["type_"] || -1;
    const startNode = mutation["startNode_"];
    const endNode = mutation["endNode_"];
    let modifiedObj = cy.collection();

    if (!type || !startNode) {
      return modifiedObj;
    }

    switch (type) {
      case 1:
        // add node
        if (cy.getElementById(startNode).length !== 0) {
          modifiedObj = cy.getElementById(startNode);
          // color this node green
          modifiedObj.style('background-color', 'green');
          addedNodes = addedNodes.union(modifiedObj);
        }
        break;
      case 2:
        // add edge
        if (endNode && cy.getElementById(startNode).length !== 0 && cy.getElementById(endNode).length !== 0) {
          modifiedObj = cy.getElementById(`edge${startNode}${endNode}`);
          // color this edge green
          modifiedObj.style('line-color', 'green');
          modifiedObj.style('target-arrow-color', 'green');
          addedEdges = addedEdges.union(modifiedObj);
        }
        break;
      case 3:
        // delete node
        // add a phantom node (if it doesn't already exist) and color it red
        if (cy.getElementById(startNode).length === 0) {
          cy.add({
            group: "nodes",
            data: { id: startNode }
          });
        }
        modifiedObj = cy.getElementById(startNode);
        modifiedObj.style('background-color', 'red');
        modifiedObj.style('opacity', 0.25);
        deletedNodes = deletedNodes.union(modifiedObj);
        break;
      case 4:
        // delete edge
        if (!endNode) {
          break;
        }
        // if corresponding nodes don't exist, add them
        if (cy.getElementById(startNode).length === 0) {
          cy.add({
            group: "nodes",
            data: { id: startNode }
          });
        }
        if (cy.getElementById(endNode).length === 0) {
          cy.add({
            group: "nodes",
            data: { id: endNode }
          });
        }
        // Add a phantom edge and color it red
        cy.add({
          group: "edges",
          data: {
            id: `edge${startNode}${endNode}`,
            target: endNode,
            source: startNode
          }
        });
        modifiedObj = cy.getElementById(`edge${startNode}${endNode}`);
        modifiedObj.style('line-color', 'red');
        modifiedObj.style('target-arrow-color', 'red');
        modifiedObj.style('opacity', 0.25);
        deletedEdges = deletedEdges.union(modifiedObj);
        break;
      case 5:
        // change node
        if (cy.getElementById(startNode).length !== 0) {
          modifiedObj = cy.getElementById(startNode);
          modifiedObj.style('background-color', 'yellow');
          modifiedNodes = modifiedNodes.union(modifiedObj);
        }
        break;
      default:
        break;
    }
    if (modifiedObj.length !== 0) {
      initializeReasonTooltip(cy, modifiedObj, reason)
    }
  });
  return [deletedNodes, deletedEdges, addedNodes, addedEdges, modifiedNodes];
}


/**
 * Initializes a tooltip with reason as its contents that displays when the object
 * is hovered over
 * @param {*} cy the graph object
 * @param {*} obj the object to display the tooltip over when hovered
 * @param {*} reason the reason for the mutation
 */
function initializeReasonTooltip(cy, obj, reason) {
  const tipPosition = obj.popperRef(); // used only for positioning

  // a dummy element must be passed as tippy only accepts a dom element as the target
  const dummyDomEle = document.createElement('div');

  obj.reasonTip = tippy(dummyDomEle, {
    trigger: 'manual',
    lazy: false,
    onCreate: instance => { instance.popperInstance.reference = tipPosition; },

    content: () => {
      let text = document.createElement("p");
      text.innerText = !reason ? "Reason not specified" : reason;
      return text;
    },
    sticky: true,
    plugins: [sticky]
  });
}

/**
 * Shows the mutations made to this graph by highlighting them and enabling their
 * tooltips 
 * 
 * @param {*} cy the graph to modify
 * @param {*} elems all the elements to mutate
 * @param {*} deletedNodes the nodes which were deleted to get this graph (red)
 * @param {*} deletedEdges the edges which were deleted to get this graph (red)
 * @param {*} addedNodes the nodes which were added to get this graph (green)
 * @param {*} addedEdges the edges which were added to get this graph (green)
 * @param {*} modifiedNodes the nodes which were modified to get this graph (yellow)
 */
function showDiffs(cy, elems, deletedNodes, deletedEdges, addedNodes, addedEdges, modifiedNodes) {
  // Add phantom nodes and edges to represent deleted objects
  cy.add(deletedNodes);
  cy.add(deletedEdges);

  // Color "deleted" nodes and edges in red 
  deletedNodes.style("background-color", "red");
  deletedEdges.style("line-color", "red");
  deletedEdges.style("target-arrow-color", "red");

  // Color "added" nodes and edges in green
  addedNodes.style("background-color", "green");
  addedEdges.style("line-color", "green");
  addedEdges.style("target-arrow-color", "green");

  // Color nodes whose metadata changed in yellow
  modifiedNodes.style("background-color", "yellow");

  // Activate tooltips and zoom in on mutated objects
  makeInteractiveAndFocus(cy, elems);
}

/**
 * Activates tooltips that open on hovering over objects in elems and then zooms 
 * in on these elements if possible
 * @param {*} cy the graph to modify
 * @param {*} elems the elements for which tooltips should be shown on mouseover
 */
function makeInteractiveAndFocus(cy, elems) {
  // Add listeners to show and hide tooltips
  elems.on('mouseover', function (evt) {
    if (evt.target.reasonTip) {
      evt.target.reasonTip.show();
    }
  });
  elems.on('mouseout', function (evt) {
    if (evt.target.reasonTip) {
      evt.target.reasonTip.hide();
    }
  });
  cy.fit(elems);
}

/**
 * Undoes the highlighted mutations on the graph, displaying only the base graph
 * 
 * @param {*} cy the graph to modify
 * @param {*} elems all the elements that were mutated
 * @param {*} deletedNodes the nodes which were deleted to get this graph 
 * @param {*} deletedEdges the edges which were deleted to get this graph 
 * @param {*} addedNodes the nodes which were added to get this graph 
 * @param {*} addedEdges the edges which were added to get this graph 
 * @param {*} modifiedNodes the nodes which were modified to get this graph 
 */
function hideDiffs(cy, elems, deletedNodes, deletedEdges, addedNodes, addedEdges, modifiedNodes) {
  // Remove phantom nodes and edges
  cy.remove(deletedNodes);
  cy.remove(deletedEdges);

  // Reset the color of "added" and modified" nodes and edges 
  addedNodes.style("background-color", "blue");
  modifiedNodes.style("background-color", "blue");
  addedEdges.style("line-color", "#ccc");
  addedEdges.style("target-arrow-color", "#ccc");

  // Remove event listeners for tooltip manipulation
  elems.removeListener('mouseover');
  elems.removeListener('mouseout');

  // zoom out
  cy.fit();
}

/**
 * Zooms in on specific node
 */
function searchNode(cy, query) {
  // reset nodes to default color
  cy.nodes().forEach(node => {
    node.style('background-color', 'blue');
    node.style('opacity', '1')
  });
  const target = findNodeInGraph(cy, query);
  if (target) {
    cy.nodes().forEach(node => node.style('opacity', '0.25'));
    target.style('background-color', 'olive');
    target.style('opacity', '1');
    cy.fit(target, 50);
    return true;
  } else {
    // fits all nodes on screen
    cy.fit(cy.nodes(), 50);
    return false;
  }
}

/**
 * Finds element in cy graph by id
 */
function findNodeInGraph(cy, id) {
  if (id.length != 0) {
    const target = cy.getElementById(id);
    if (target.length != 0) {
      return target;
    }
  }
  return null;
}

/**
 * Initializes a tooltip containing the node's token list
 */
function initializeTippy(node) {
  const tipPosition = node.popperRef(); // used only for positioning

  // a dummy element must be passed as tippy only accepts a dom element as the target
  const dummyDomEle = document.createElement('div');

  node.tip = tippy(dummyDomEle, {
    trigger: 'manual',
    lazy: false,
    onCreate: instance => { instance.popperInstance.reference = tipPosition; },

    content: () => getTooltipContent(node),
    interactive: true,
    appendTo: document.body,
    // the tooltip  adheres to the node if the graph is zoomed in on
    sticky: true,
    plugins: [sticky]
  });
}

/**
 * Takes in a node and returns an HTML element containing the element's
 * tokens formatted into an HTML unordered list with a close button if
 * the node has tokens and a message indicating so if it doesn't.
 */
function getTooltipContent(node) {
  const content = document.createElement("div");

  // Create button that will close the tooltip
  const closeButton = document.createElement("button");
  closeButton.innerText = "close";
  closeButton.classList.add("material-icons", "close-button");
  closeButton.addEventListener('click', function () {
    node.tip.hide();
  }, false);
  content.appendChild(closeButton);

  const nodeTokens = node.data("tokens");
  if (nodeTokens === undefined || nodeTokens.length === 0) {
    // The node has an empty token list
    const noTokenMsg = document.createElement("p");
    noTokenMsg.innerText = "No tokens";
    content.appendChild(noTokenMsg);
  } else {
    // The node has some tokens
    const tokenList = document.createElement("ul");
    nodeTokens.forEach(token => {
      const tokenItem = document.createElement("li");
      tokenItem.innerText = token;
      tokenList.appendChild(tokenItem);
    });
    tokenList.className = "tokenlist";
    content.appendChild(tokenList);
  }
  content.className = "metadata";

  return content;
}

/**
 * When a next/previous button is clicked, modifies the mutation index of the
 * current graph to represent the new state. Then, the corresponding
 * graph is requested from the server.
 */
function navigateGraph(amount) {
  currGraphNum += amount;
  if (currGraphNum <= 0) {
    currGraphNum = 0;
  }
  if (currGraphNum >= numMutations) {
    currGraphNum = numMutations;
  }
}

/**
 * Updates next and previous buttons of the graph to prevent user
 * from clicking previous for the initial graph and next for the 
 * final graph
 * Assumes currGraphNum is between 0 and numMutations
 */
function updateButtons() {
  if (currGraphNum === 0) {
    document.getElementById("prevbutton").disabled = true;
  } else {
    document.getElementById("prevbutton").disabled = false;
  }
  if (currGraphNum === numMutations) {
    document.getElementById("nextbutton").disabled = true;
  } else {
    document.getElementById("nextbutton").disabled = false;
  }
}