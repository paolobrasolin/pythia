import Utils from "./utils";

describe("Utils.offsetPairs", () => {
  test("identity on empty array", () => {
    expect(Utils.offsetPairs([])).toEqual([]);
  });

  test("clockwise offsets of single points", () => {
    expect(Utils.offsetPairs([[0, 0]], 1)).toEqual([
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1]
    ]);
  });

  test("clockwise offsets of multiple points", () => {
    expect(Utils.offsetPairs([[0, 0], [5, 5]], 1)).toEqual([
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
      [6, 6],
      [4, 6],
      [4, 4],
      [6, 4]
    ]);
  });
});
