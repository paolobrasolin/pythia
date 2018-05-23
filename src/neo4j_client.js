const queries = {
  deleteDependencies: `
    MATCH (:Class) -[d:DEPENDS]-> (:Class) DELETE d;
  `.trim(),
  createDependencies: `
    MATCH (c1:Class) -[:OWNS]-> (:Method) -[:CONTAINS]-> (:CallSite) -[:CALLS]-> (:Method) <-[:OWNS]- (c2:Class)
    WHERE (c2.name <> c1.name)
    WITH c1, c2, count(*) as force
    MERGE (c1) -[dep:DEPENDS]-> (c2)
    SET dep.force = force
  `.trim(),
  updateEfferent: `
    MATCH (c:Class) OPTIONAL MATCH (c) -[r:DEPENDS]-> (:Class)
    WITH c, count(r) as count_r, sum(r.force) as sum_r_forces
    SET c.e_count = count_r, c.e_force = sum_r_forces
  `.trim(),
  updateAfferent: `
    MATCH (c:Class) OPTIONAL MATCH (c) <-[r:DEPENDS]- (:Class)
    WITH c, count(r) as count_r, sum(r.force) as sum_r_forces
    SET c.a_count = count_r, c.a_force = sum_r_forces
  `.trim(),
  updateNodes: `
    MATCH (c:Class)
    WITH c,
      (CASE WHEN c.e_count = 0 THEN 0.0 ELSE toFloat(c.e_count)/(c.e_count + c.a_count) END) as i_count,
      (CASE WHEN c.e_force = 0 THEN 0.0 ELSE toFloat(c.e_force)/(c.e_force + c.a_force) END) as i_force
    SET c.i_count = i_count, c.i_force = i_force
  `.trim()
};

export default class Neo4jClient {
  constructor(url, username, password) {
    this.url = url;
    this.username = username;
    this.password = password;
  }

  send(endpoint, method, data) {
    return fetch(this.url + endpoint, {
      body: JSON.stringify(data), // must match 'Content-Type' header
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "same-origin", // include, same-origin, *omit
      headers: {
        authorization: "Basic " + btoa(this.username + ":" + this.password),
        // 'user-agent': 'Mozilla/4.0 MDN Example',
        accept: "application/json",
        "content-type": "application/json; charset=utf-8"
      },
      method: method //,
      // mode: 'cors', // no-cors, cors, *same-origin
      // redirect: 'follow', // manual, *follow, error
      // referrer: 'no-referrer', // *client, no-referrer
    }).then(response => {
      return new Promise(resolve => {
        resolve(response.json());
      });
    });
  }

  commit(cypher) {
    const endpoint = "/db/data/transaction/commit";
    const data = {
      statements: [
        {
          statement: cypher,
          resultDataContents: ["graph"],
          includeStats: false
        }
      ]
    };
    return this.send(endpoint, "POST", data);
  }

  tally(response) {
    // Assumption: single query
    let data = response.results[0].data;
    let nodes = [],
      links = [];
    for (let i = 0; i < data.length; i++) {
      nodes = this.concatById(nodes, data[i].graph.nodes);
      links = this.concatById(links, data[i].graph.relationships);
    }

    for (let i = 0; i < links.length; i++) {
      this.renameProperty(links[i], "startNode", "source");
      this.renameProperty(links[i], "endNode", "target");
    }

    return {
      nodes: nodes,
      links: links
    };
  }

  renameProperty(object, oldName, newName) {
    delete Object.assign(object, { [newName]: object[oldName] })[oldName];
  }

  concatById(target, source) {
    return target.concat(
      source.filter(candidate => {
        return target.findIndex(item => item.id === candidate.id) < 0;
      })
    );
  }

  refreshDB() {
    Promise.resolve()
      .then(this.commit(queries.deleteDependencies))
      .then(this.commit(queries.createDependencies))
      .then(this.commit(queries.updateAfferent))
      .then(this.commit(queries.updateEfferent))
      .then(this.commit(queries.updateNodes))
      .then(() => {
        console.log("Done!");
      });
  }
}
