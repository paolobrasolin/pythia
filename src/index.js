import "./miserables.json";
import "./index.sass";

import Utils from "./utils";

import * as d3 from "d3";
// import 'd3-interpolate';

import Neo4jClient from "./neo4j_client";
const neo4jClient = new Neo4jClient("http://localhost:7474", "neo4j", "neo");

import Graph from "./graph";

window.neo4jClient = neo4jClient;

var svgContainer = d3
  .select("body")
  .append("div")
  .attr("id", "svg-container");

var svg = svgContainer.append("svg");

function redraw() {
  var container = document.getElementById("svg-container");
  svg
    .attr("width", container.clientWidth)
    .attr("height", container.clientHeight)
    .attr(
      "viewBox",
      `${-container.clientWidth / 2} ${-container.clientHeight / 2} ${
        container.clientWidth
      } ${container.clientHeight}`
    );
}

window.addEventListener("resize", redraw);

redraw();

var statusBar = d3
  .select("body")
  .append("span")
  .attr("id", "status-bar")
  .html("This is Pythia.");

var colorPalette = d3.scaleOrdinal(d3.schemeCategory10);

var hullCurve = d3.line().curve(d3.curveCardinalClosed.tension(0.95));

function drawHullCurve(d) {
  return hullCurve(d.path); // 0.8
}

function refreshHulls(namespace) {
  namespace.hull = [[namespace.x || 0, namespace.y || 0]];
  if (namespace.expand) {
    namespace.includes.map(refreshHulls);
    namespace.hull = namespace.hull.concat(
      ...namespace.includes.map(ns => ns.hull)
    );
    namespace.hull = Utils.offsetPairs(namespace.hull, 20);
    namespace.hull = d3.polygonHull(namespace.hull);
  }
}

function convexHulls(nodes) {
  var namespaces = nodes.filter(node => node.labels[0] === "NameSpace");
  const rootNamespace = namespaces.find(node => node.properties.name === "");

  refreshHulls(rootNamespace);

  return namespaces.filter(ns => ns.expand).map(ns => {
    return { group: ns.id, path: ns.hull };
  });
}

function listExpandedNamespaces(namespace) {
  var children = namespace.expand ? namespace.includes : [];
  return [namespace].concat(...children.map(listExpandedNamespaces));
}

function sliceNetwork(graph) {
  var namespaces = graph.nodes.filter(node => node.labels[0] === "NameSpace");
  // var includes = graph.links.filter(link => link.type === "INCLUDES");

  const rootNamespace = namespaces.find(node => node.properties.name === "");

  var ns = listExpandedNamespaces(rootNamespace);

  // var cs = ns
  //   .map(namespace => namespace.holder)
  //   .filter(holder => holder !== undefined);
  // console.log(cs);

  // console.log(ns);
  var ls = [].concat(
    ...ns.map(node => node.targetOf.filter(link => link.type === "INCLUDES"))
  );

  // console.log(ns);
  // console.log(ls);

  return {
    // nodes: [...ns, ...cs],
    nodes: ns,
    links: ls
  };
}

var hullGroup = svg.append("g");
hullGroup.attr("class", "hulls");

var linkGroup = svg.append("g");
linkGroup.attr("class", "links");

var nodeGroup = svg.append("g");
nodeGroup.attr("class", "nodes");

var link, node, graph, hull, simulation;

function ticked() {
  linkGroup
    .selectAll("line")
    .attr("x1", function(d) {
      return d.source.x;
    })
    .attr("y1", function(d) {
      return d.source.y;
    })
    .attr("x2", function(d) {
      return d.target.x;
    })
    .attr("y2", function(d) {
      return d.target.y;
    });

  nodeGroup
    .selectAll("circle")
    .attr("cx", function(d) {
      return d.x;
    })
    .attr("cy", function(d) {
      return d.y;
    });

  if (!hull.empty()) {
    hull.data(convexHulls(graph.nodes)).attr("d", drawHullCurve);
  }
}

simulation = d3
  .forceSimulation()
  .force(
    "link",
    d3
      .forceLink()
      .id(d => d.id)
      .strength(1)
    // .distance(150)
  )
  .force("charge", d3.forceManyBody())
  // .force("center", d3.forceCenter(0, 0))
  .force("radius", d3.forceCollide(15));

function init(data) {
  simulation.stop();

  // console.log("REINITING");

  graph = sliceNetwork(data);

  link = linkGroup.selectAll("line").data(graph.links);
  link
    .exit()
    .transition(d3.transition().duration(200))
    .remove();
  link
    .enter()
    .append("line")
    .attr("class", "includes");

  node = nodeGroup.selectAll("circle").data(graph.nodes, node => node.id);
  node
    .exit()
    .transition(d3.transition().duration(200))
    .attr("r", 0)
    .style("fill-opacity", 1e-6)
    .remove();

  node
    .enter()
    .append("circle")
    .attr("r", d => (d.includes.length > 0 ? 15 : 10))
    // .attr("r", d => (d.includes.length > 1 ? 10 : 5))
    // .attr("x", d => (d.included ? d.included.x : 0))
    // .attr("y", d => (d.included ? d.included.y : 0))
    .attr("fill", d => colorPalette(d.group))
    .on("mouseover", mouseover)
    .on("mouseout", mouseout)
    .on("dblclick", d => {
      d.expand = !d.expand;
      init(graph);
    })
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  hullGroup.selectAll("path").remove();
  hull = hullGroup
    .selectAll("path")
    .data(convexHulls(graph.nodes))
    .enter()
    .append("path")
    .attr("class", "hull")
    .attr("d", drawHullCurve);
  // .on("click", function(d) {
  //   console.log("hull click", d, arguments, this, expand[d.group]);
  //   expand[d.group] = false;
  //   init();
  // });

  // node.append("title").text(function(d) {
  //   return d.id;
  // });

  simulation.nodes(graph.nodes).on("tick", ticked);
  simulation.force("link").links(graph.links);
  simulation.restart();
}

neo4jClient.fetchData().then(function(data) {
  graph = new Graph(data);
  graph.denormalize();
  init(graph.data);
  console.log(graph.data);
});

function mouseover(d) {
  d.hovered = true;
  // console.log("OVER");
  d.fx = d.x;
  d.fy = d.y;
  statusBar.html(d.properties.name);
}

function mouseout(d) {
  d.hovered = false;
  // console.log("OUT");
  if (!d.sticky) {
    d.fx = null;
    d.fy = null;
  }
  statusBar.html("");
}

function dragstarted(d) {
  d.dragged = true;
  if (d3.event.sourceEvent.shiftKey) {
    d.sticky = !d.sticky;
  }
  // console.log("DRAG START");
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  // d.fx = d.x;
  // d.fy = d.y;
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragged(d) {
  d.dragged = true;
  // console.log("DRAG");
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  d.dragged = false;
  // console.log("DRAG END");
  if (!d3.event.active) simulation.alphaTarget(0);
  if (!d.hovered && !d.sticky) {
    d.fx = null;
    d.fy = null;
  }
}

// function dblclick(d) {
//   if (!d3.event.active) simulation.alphaTarget(0);
//   d.fx = null;
//   d.fy = null;
// }
