const crypto = require("crypto");

const numOfCharacters = 20;

function getShortId(data) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return toBase64Url(hash.digest("base64").slice(0, numOfCharacters));
}

// Remove ilegal url characters
function toBase64Url(s = "") {
  return s
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

module.exports = getShortId;
