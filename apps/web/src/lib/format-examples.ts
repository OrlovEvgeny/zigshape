// Initial samples used by the per-format SEO landing pages.  Kept separate
// from the playground's `examples.ts` (which powers the dropdown) so each
// landing page boots into a sample shaped like the format it advertises.

import type { Example } from "./examples";

export const JSON_DEFAULT: Example = {
  id: "seo-json",
  label: "JSON sample",
  rootName: "User",
  target: "plain",
  samples: [
    `{
  "id": 42,
  "name": "Alice",
  "roles": ["admin", "user"],
  "profile": { "createdAt": "2026-01-01T10:00:00Z", "active": true }
}`,
  ],
};

export const YAML_DEFAULT: Example = {
  id: "seo-yaml",
  label: "YAML sample",
  rootName: "Config",
  target: "plain",
  samples: [
    `name: myapp
replicas: 3
labels:
  app: api
  tier: backend
ports:
  - 8080
  - 8443
`,
  ],
};

export const TOML_DEFAULT: Example = {
  id: "seo-toml",
  label: "TOML sample",
  rootName: "Config",
  target: "plain",
  samples: [
    `title = "myapp"
port = 3000
debug = false

[database]
host = "localhost"
name = "main"
`,
  ],
};

export const XML_DEFAULT: Example = {
  id: "seo-xml",
  label: "XML sample",
  rootName: "User",
  target: "serde-zig",
  samples: [
    `<user id="42">
  <name>Alice</name>
  <role>admin</role>
</user>
`,
  ],
};
