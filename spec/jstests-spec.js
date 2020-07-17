import { initializeNumMutations, setCurrGraphNum, initializeTippy, generateGraph, getUrl, navigateGraph, currGraphNum, numMutations, updateButtons, search, searchNode, searchToken } from "../src/main/webapp/script.js";

import cytoscape from "cytoscape";

describe("Checking that depth in fetch url is correct", function() {
  let numLayers = {};

  beforeEach(function() {
    numLayers = document.createElement("input");
    numLayers.id = "num-layers";
  });

  afterEach(function() {
    document.body.innerHTML = '';
  });

  it("accepts a large valid depth value", function() {
    numLayers.value = 15;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("15");
  });

  it("accepts a small valid depth value", function() {
    numLayers.value = 2;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("2");
  });

  it("fills in default value if input has no value", function() {
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("3");

  });

  it("rounds up negative depths to 0", function() {
    numLayers.value = -5;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("0");
  });

  it("rounds down depths larger than 20 to 20", function() {
    numLayers.value = 80;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("20");
  });

  it("rounds a decimal depth value to the nearest number", function() {
    numLayers.value = 2.8;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("3");
  });

  it("rounds up negative decimals to 0", function() {
    numLayers.value = -2.8;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("0");
  });

  it("rounds up decimals above 20 to 20", function() {
    numLayers.value = 200.8;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("20");
  });
})


describe("Initializing tooltips", function() {

  it("initializes the tooltip of a node with tokens as a list of tokens", function() {
    document.body.innerHTML = `
    <div id="cy"></div>`;
    const cy = cytoscape({
      elements: [
      ]
    });
    const nodeWithToken = {};
    nodeWithToken["data"] = {};
    nodeWithToken["data"]["id"] = "A";
    nodeWithToken["data"]["tokens"] = ["a.js", "b.js", "c.js"];
    cy.add(nodeWithToken);
    const myNode = cy.nodes()[0];
    initializeTippy(myNode);
    const content = myNode.tip.popperChildren.content.firstChild;
    expect(content.nodeName).toBe("DIV");
    expect(content.classList.contains("metadata")).toBe(true);

    const children = content.childNodes;
    expect(children.length).toBe(2);
    const closeButton = children[0];
    expect(closeButton.nodeName).toBe("BUTTON");

    // Click on node and make sure tippy shows
    myNode.tip.show();
    expect(myNode.tip.state.isVisible).toBe(true);

    // close the tip and make sure tippy is hidden
    closeButton.click();
    expect(myNode.tip.state.isVisible).toBe(false);

    // Make assertions about tooltip content
    const tokenList = children[1];
    expect(tokenList.nodeName).toBe("UL");
    const tokens = tokenList.childNodes;
    expect(tokens.length).toBe(3);
    expect(tokens[0].nodeName).toBe("LI");
    expect(tokens[0].textContent).toBe("a.js");
    expect(tokens[1].nodeName).toBe("LI");
    expect(tokens[1].textContent).toBe("b.js");
    expect(tokens[2].nodeName).toBe("LI");
    expect(tokens[2].textContent).toBe("c.js");
  });

  it("indicates that a node without tokens has no tokens", function() {
    document.body.innerHTML = `
    <div id="cy"></div>`;
    const cy = cytoscape({
      elements: [
      ]
    });
    const nodeWithoutToken = {};
    nodeWithoutToken["data"] = {};
    nodeWithoutToken["data"]["id"] = "B";
    nodeWithoutToken["data"]["tokens"] = [];
    cy.add(nodeWithoutToken);
    const myNode = cy.nodes()[0];
    initializeTippy(myNode);
    const content = myNode.tip.popperChildren.content.firstChild;
    expect(content.nodeName).toBe("DIV");
    expect(content.classList.contains("metadata")).toBe(true);

    const children = content.childNodes;
    expect(children.length).toBe(2);
    const closeButton = children[0];
    expect(closeButton.nodeName).toBe("BUTTON");

    // Click on node and make sure tippy shows
    myNode.tip.show();
    expect(myNode.tip.state.isVisible).toBe(true);

    // close the tip and make sure tippy is hidden
    closeButton.click();
    expect(myNode.tip.state.isVisible).toBe(false);

    // Make assertions about tooltip content
    const tokenMsg = children[1];
    expect(tokenMsg.nodeName).toBe("P");
    expect(tokenMsg.textContent).toBe("No tokens");
  });
});

describe("Pressing next and previous buttons associated with a graph", function() {
  it("correctly updates mutation tracking variables and buttons on click", function() {
    initializeNumMutations(3);
    const prevButton = document.createElement("button");
    prevButton.id = "prevbutton";
    prevButton.onclick = () => { navigateGraph(-1); updateButtons(); };
    const nextButton = document.createElement("button");
    nextButton.id = "nextbutton";
    nextButton.onclick = () => { navigateGraph(1); updateButtons(); };
    document.body.appendChild(prevButton);
    document.body.appendChild(nextButton);

    expect(currGraphNum).toBe(0);
    expect(numMutations).toBe(3);

    nextButton.click();
    expect(currGraphNum).toBe(1);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);

    nextButton.click();
    expect(currGraphNum).toBe(2);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);

    nextButton.click();
    expect(currGraphNum).toBe(3);
    expect(nextButton.disabled).toBe(true);
    expect(prevButton.disabled).toBe(false);

    prevButton.click();
    expect(currGraphNum).toBe(2);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);

    prevButton.click();
    expect(currGraphNum).toBe(1);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);

    nextButton.click();
    expect(currGraphNum).toBe(2);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);

    prevButton.click();
    expect(currGraphNum).toBe(1);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);

    prevButton.click();
    expect(currGraphNum).toBe(0);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(true);

    prevButton.click();
    expect(currGraphNum).toBe(0);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(true);

    nextButton.click();
    expect(currGraphNum).toBe(1);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);
  });
});

describe("Check correct url params", function() {
  let nodeName = {}; 
  beforeEach(function() {
    setCurrGraphNum(1);
    nodeName = document.createElement("input");
    nodeName.id = "node-name";
  });

  afterEach(function() {
    setCurrGraphNum(0);
     document.body.innerHTML = '';
  });

  it("passes correct value of the mutations number in the fetch request", function() {
    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("3");
    expect(constructedUrl.has("mutationNum")).toBe(true);
    expect(constructedUrl.get("mutationNum")).toBe("1");

    // Not on page here, should be empty
    expect(constructedUrl.has("nodeName")).toBe(true);
    expect(constructedUrl.get("nodeName")).toBe("");
  });

  it ("passes correct nodeName when nodeName has a value", function () {
    nodeName.value = "A";
    document.body.appendChild(nodeName);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));

    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("nodeName")).toBe(true);
    expect(constructedUrl.get("nodeName")).toBe("A"); 
  })
});

describe("Node search", function() {
  const cy = cytoscape({
    elements: [
      { data: { id: "A" } },
      { data: { id: "B" } },
      {
        data: {
          id: "edgeAB",
          source: "A",
          target: "B"
        }
      }]
  });

  let numSelected;
  let nodeError;
  let query;
  beforeEach(function() {
    document.body.innerHTML = "";

    numSelected = document.createElement("label");
    numSelected.id = "num-selected";
    document.body.appendChild(numSelected);

    nodeError = document.createElement("label");
    nodeError.id = "node-error";
    document.body.appendChild(nodeError);

    query = document.createElement("input");
    query.id = "node-search";
    document.body.appendChild(query);
  });

  it("should be a successful node search", function() {
    query.value = "A";
    const result = search(cy, "node", searchNode);

    // should not display error message
    expect(nodeError.innerText).toBe("");
    expect(result.id()).toBe("A");
  });

  it("should be an unsuccessful node search", function() {
    query.value = "C";
    const result = search(cy, "node", searchNode);

    // should display error message
    expect(nodeError.innerText).not.toBe("");
  });

  it("should not search for a node at all", function() {
    query.value = "";
    const result = search(cy, "node", searchNode);

    // should not display error message
    expect(nodeError.innerText).toBe("");
  });
});

describe("Token search", function() {
  let numSelected;
  let tokenError;
  let query;
  let cy;

  beforeEach(function() {
    document.body.innerHTML = `
    <div id="cy"></div>`;
    cy = cytoscape({
      elements: [
      ],
      container: document.getElementById("cy"),
    });
    const nodeWithToken1 = {};
    nodeWithToken1["data"] = {};
    nodeWithToken1["data"]["id"] = "A";
    nodeWithToken1["data"]["tokens"] = ["a.js", "b.js", "c.js"];
    cy.add(nodeWithToken1);
    let myNode = cy.nodes()[0];
    initializeTippy(myNode);

    const nodeWithToken2 = {};
    nodeWithToken2["data"] = {};
    nodeWithToken2["data"]["id"] = "B";
    nodeWithToken2["data"]["tokens"] = ["b.js"];
    cy.add(nodeWithToken2);
    myNode = cy.nodes()[1];
    initializeTippy(myNode);

    numSelected = document.createElement("label");
    numSelected.id = "num-selected";
    document.body.appendChild(numSelected);

    tokenError = document.createElement("label");
    tokenError.id = "token-error";
    document.body.appendChild(tokenError);

    query = document.createElement("input");
    query.id = "token-search";
    document.body.appendChild(query);
  });

  it("should be a successful token search", function() {
    query.value = "a.js";
    const result = search(cy, "token", searchToken);

    // error message should not be displayed
    expect(tokenError.innerText).toBe("");
    expect(result.length).toBe(1);
    expect(result[0].id()).toBe("A");
  });

  it("should be a successful token search with multiple nodes", function() {
    query.value = "b.js";
    const result = search(cy, "token", searchToken);

    // error message should not be displayed
    expect(tokenError.innerText).toBe("");
    expect(result.length).toBe(2);
    expect(result[0].id()).toBe("A");
    expect(result[1].id()).toBe("B");
  });

  it("should be an unsuccessful token search", function() {
    query.value = "fake_file.js";
    const result = search(cy, "token", searchToken);

    // error message should be displayed
    expect(tokenError.innerText).not.toBe("");
    expect(result).toBeUndefined();
  });

  it("should not search for a token at all", function() {
    query.value = "";
    const result = search(cy, "token", searchToken);

    // error message should not be displayed
    expect(tokenError.innerText).toBe("");
    expect(result).toBeUndefined();
  });
});


