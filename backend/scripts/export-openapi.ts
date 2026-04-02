import { swaggerSpec } from "../src/config/swagger";
import { writeFileSync } from "fs";
import { resolve } from "path";

const outputPath = resolve(__dirname, "../../packages/shared-types/openapi.json");
writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));
console.log(`OpenAPI spec exported to ${outputPath}`);
