export default {
  offsetPairs(pairs, offset) {
    var newPairs = pairs.map(pair => [
      [pair[0] + offset, pair[1] + offset],
      [pair[0] - offset, pair[1] + offset],
      [pair[0] - offset, pair[1] - offset],
      [pair[0] + offset, pair[1] - offset]
    ]);
    return [].concat(...newPairs);
  }
};
