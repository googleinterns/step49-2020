const colorScheme = {
  "unmodifiedNodeColor": "blue",
  "addedObjectColor": "green",
  "deletedObjectColor": "red",
  "modifiedNodeColor": "yellow",
  "unmodifiedEdgeColor": "grey",
  "labelColor": "white", 
  "filteredNodeColor": "#FF00FF"
};
// Sets the opacity constants for different types of objects in the graph
const opacityScheme = {
  "deletedObjectOpacity": 0.25
};

const tippySize = {
  "width": 450
};

const borderScheme = {
  "queriedBorder": "5px"
}

module.exports = {
  colorScheme, 
  opacityScheme,
  tippySize,
  borderScheme,
}