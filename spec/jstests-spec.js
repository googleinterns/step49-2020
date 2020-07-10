import  {initializeTippy, generateGraph, getUrl, navigateGraph, currGraphNum, numMutations  } from "../src/main/webapp/script.js";
import cytoscape from "cytoscape";

describe("Checking that depth in fetch url is correct", function() {
  let numLayers = {};
  beforeEach(function () {
    numLayers = document.createElement("input");
    numLayers.id = "num-layers";
  })
  afterEach(function () {
    document.body.innerHTML = '';
  })
  it("Input valid large value for depth", function() {
    numLayers.value = 15;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("15");
  });
  it("Input valid small value for depth", function() {
    numLayers.value = 2;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("2");
  });
  it("Input no value for depth", function() {
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("3");

  });
  it("Input negative value for depth", function() {
    numLayers.value = -5;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("0");
  });
  it("Input too large value for depth", function() {
    numLayers.value = 80;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("20");
  });
  it("Input decimal for depth", function() {
    numLayers.value = 2.8;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("3");
  });
  it("Input negative decimal for depth", function() {
    numLayers.value = -2.8;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("0");
  });
  it("Input large decimal for depth", function() {
    numLayers.value = 200.8;
    document.body.appendChild(numLayers);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("20");
  });
})


describe("Checking that tooltip is correctly initialized", function() {
  it("Node with tokens", function() {
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
    const closeButton =  children[0];
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
  it("Node without tokens", function() {
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
    const closeButton =  children[0];
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

describe("Checking that graph number in fetch url is correct", function() {
  it("Button presses generate correct request", function() {

    const prevButton = document.createElement("button");
    prevButton.id = "prevbutton";
    prevButton.onclick = () => navigateGraph(-1);
    const nextButton = document.createElement("button");
    nextButton.id = "nextbutton";
    nextButton.onclick = () => navigateGraph(1);
    document.body.appendChild(prevButton);
    document.body.appendChild(nextButton);

    expect(currGraphNum).toBe(0);
    expect(numMutations).toBe(3);

    nextButton.click();
    expect(currGraphNum).toBe(1);

    nextButton.click();
    expect(currGraphNum).toBe(2);

    nextButton.click();
    expect(currGraphNum).toBe(3);

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

    prevButton.click();
    expect(currGraphNum).toBe(1);

    prevButton.click();
    expect(currGraphNum).toBe(0);

    prevButton.click();
    expect(currGraphNum).toBe(0);

    prevButton.click();
    expect(currGraphNum).toBe(0);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(true);
 
    nextButton.click();
    expect(currGraphNum).toBe(1);
    expect(nextButton.disabled).toBe(false);
    expect(prevButton.disabled).toBe(false);

    const requestString = getUrl();
    const requestParams = requestString.substring(requestString.indexOf("?"));
    
    const constructedUrl = new URLSearchParams(requestParams);
    expect(constructedUrl.has("depth")).toBe(true);
    expect(constructedUrl.get("depth")).toBe("3");
    expect(constructedUrl.has("mutationNum")).toBe(true);
    expect(constructedUrl.get("mutationNum")).toBe("1");
  });
});