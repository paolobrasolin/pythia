const queries = {
  fetchHolds: `
    MATCH (c1:Class) -[d:HOLDS]-> (c2:NameSpace)
    RETURN *
  `.trim(),
  fetchNamespaces: `
    MATCH (c1:NameSpace) -[d:INCLUDES]-> (c2:NameSpace)
    RETURN *
  `.trim(),
  fetchDependencies: `
    MATCH (c1:Class) -[d:DEPENDS]-> (c2:Class)
    RETURN *
  `.trim(),
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
  `.trim(),
  deleteNameSpaceNodes: `
    MATCH (n:NameSpace) DELETE n
  `.trim(),
  createNameSpaceNodes: `
    MATCH (n:Class)
    WITH n, split(n.name, "::") as frags
    FOREACH (n IN range(0, size(frags)) |
      MERGE (:NameSpace {name: REDUCE (scope = "", n IN frags[0..n] | scope + "::" + n)}) )
  `.trim(),
  createIndexNamespaces: `
    CREATE INDEX ON :NameSpace(name)
  `.trim(),
  dropIndexNamespaces: `
    DROP INDEX ON :NameSpace(name)
  `.trim(),
  deleteHoldsRelations: `
    MATCH (:Class) -[r:HOLDS]-> (:NameSpace) DELETE r
  `.trim(),
  createHoldsRelations: `
    MATCH (ns:NameSpace), (c:Class)
    WHERE ns.name = "::" + c.name
    MERGE (c) -[:HOLDS]-> (ns)
  `.trim(),
  deleteIncludesRelations: `
    MATCH (:NameSpace) -[r:INCLUDES]-> (:NameSpace) DELETE r
  `.trim(),
  createIncludesRelations: `
    MATCH (n:NameSpace)
    WITH n, split(n.name, "::") as frags
    WITH n, REDUCE (scope = "", n IN frags[1..-1] | scope + "::" + n) as parent_name
    MATCH (m:NameSpace {name: parent_name})
    WHERE n <> m
    MERGE (m) -[:INCLUDES]-> (n)
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
    })
      .then(response => {
        return response.json();
      })
      .then(response => {
        // console.log(response);
        return new Promise(resolve => {
          resolve(response);
        });
      });
  }

  commit(cyphers) {
    const endpoint = "/db/data/transaction/commit";
    // console.log(cyphers);
    const statements = cyphers.map(cypher => {
      return {
        statement: cypher,
        resultDataContents: ["graph"],
        includeStats: true
      };
    });
    const data = { statements: statements };
    return this.send(endpoint, "POST", data);
  }

  flatten(response) {
    let nodes = [],
      links = [];

    for (let j = 0; j < response.results.length; j++) {
      let data = response.results[j].data;

      for (let i = 0; i < data.length; i++) {
        nodes = this.concatUniqueById(nodes, data[i].graph.nodes);
        links = this.concatUniqueById(links, data[i].graph.relationships);
      }
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

  concatUniqueById(target, source) {
    return target.concat(
      source.filter(candidate => {
        return target.findIndex(item => item.id === candidate.id) < 0;
      })
    );
  }

  fetchData() {
    return this.commit([
      queries.fetchDependencies,
      queries.fetchNamespaces,
      queries.fetchHolds
    ]).then(result => {
      return this.flatten(result);
    });
  }

  fetchDependencies() {
    return this.commit([queries.fetchDependencies]).then(result => {
      return this.flatten(result);
    });
  }

  fetchNamespaces() {
    return this.commit([queries.fetchNamespaces]).then(result => {
      return this.flatten(result);
    });
  }

  refreshDependencies() {
    this.commit([
      queries.deleteDependencies,
      queries.createDependencies,
      queries.updateAfferent,
      queries.updateEfferent,
      queries.updateNodes
    ]);
  }

  createNamespacing() {
    this.commit([
      queries.createNameSpaceNodes,
      queries.createIncludesRelations,
      queries.createHoldsRelations
    ]);
  }

  deleteNamespacing() {
    this.commit([
      queries.deleteHoldsRelations,
      queries.deleteIncludesRelations,
      queries.deleteNameSpaceNodes
    ]);
  }
}
