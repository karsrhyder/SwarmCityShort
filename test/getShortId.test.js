const assert = require("assert");
const getShortId = require("../utils/getShortId");

describe("Util: getShortId", () => {
  it("should return a valid hash with random data", () => {
    const id = getShortId("some data");
    assert.equal(id, "EweZDmulyhRes16ZGCqb");
  });

  it("should return a valid hash with some params", () => {
    const id = getShortId(
      JSON.stringify({
        title: "item title",
        description: "item description"
      })
    );
    assert.equal(id, "da49j0uB4umlgHSLf7n9");
  });
});
