import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import { argv } from "node:process";

const identity = argv[2];
if (identity !== "evidence" && identity !== "evolution") {
  throw new Error("stub identity must be evidence or evolution");
}

createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    response.writeHead(200, {
      "content-type": "application/json",
      "x-upstream": identity,
    });
    response.end(
      JSON.stringify({
        identity,
        method: request.method,
        url: request.url,
        body: Buffer.concat(chunks).toString("utf8"),
      }),
    );
  });
}).listen(8080, "0.0.0.0");
