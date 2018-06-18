export default class Graph {
  constructor(data) {
    this.data = data;
  }

  denormalize() {
    var k;

    for (k = 0; k < this.data.links.length; ++k) {
      this.data.links[k].source = this.data.nodes.find(
        node => node.id === this.data.links[k].source
      );
      this.data.links[k].target = this.data.nodes.find(
        node => node.id === this.data.links[k].target
      );
    }

    var namespaces = this.data.nodes.filter(
      node => node.labels[0] === "NameSpace"
    );
    var includes = this.data.links.filter(link => link.type === "INCLUDES");

    for (k = 0; k < namespaces.length; ++k) {
      namespaces[k].includes = [];
      namespaces[k].included = null;
    }

    var holds = this.data.links.filter(link => link.type === "HOLDS");

    for (k = 0; k < holds.length; ++k) {
      holds[k].source.held = holds[k].target;
      holds[k].target.holder = holds[k].source;
    }

    for (k = 0; k < includes.length; ++k) {
      includes[k].source.includes.push(includes[k].target);
      includes[k].target.included = includes[k].source;
    }

    for (k = 0; k < this.data.nodes.length; ++k) {
      this.data.nodes[k].sourceOf = [];
      this.data.nodes[k].targetOf = [];
    }

    for (k = 0; k < this.data.links.length; ++k) {
      var link = this.data.links[k];
      link.source.sourceOf.push(link);
      link.target.targetOf.push(link);
    }
  }
}
