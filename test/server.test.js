//During the test the env variable is set to test
process.env.NODE_ENV = "test";

const chai = require("chai");
const expect = chai.expect;
const chaiHttp = require("chai-http");
chai.use(chaiHttp);

const server = require("../server");

describe("Server integration test", () => {
  describe("Default index page", () => {
    it("should return a default html", async () => {
      const res = await chai.request(server).get("/");
      expect(res).to.be.html;
      expect(res).to.have.status(200);
      expect(res.text).to.include("Swarm City short url service");
    });
  });

  describe("Register POST", () => {
    const id = "SR7HkA9aWsSdjeB1vubQ";
    const params = {
      title: "item title",
      description: "item description",
      redirectUrl:
        "https://swarm.city/detail/0x9546d3f484ed056773c535de6c934240ff0b49f9/0x15b32cc18650e02a99841f29543257cd86056568b75dcfdd1e5dbe07f9b6a4ad"
    };
    it("should accept a post request to store params", async () => {
      const res = await chai
        .request(server)
        .post("/")
        .type("json")
        .send(params);

      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({ id });
    });

    it("should retrieve a redirect html with the generated id", async () => {
      const res = await chai.request(server).get(`/${id}`);
      if (res.error) console.log(res.error);
      expect(res).to.be.html;
      expect(res).to.have.status(200);
      expect(res.text).to.include(params.title);
      expect(res.text).to.include(params.description);
      expect(res.text).to.include(params.redirectUrl);
    });

    it("should return error retrieving an unkown id", async () => {
      const res = await chai.request(server).get(`/missingId`);
      expect(res).to.be.html;
      expect(res).to.have.status(404);
      expect(res.text).to.include("NotFoundError");
    });
  });
});
