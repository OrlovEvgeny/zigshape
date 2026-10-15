import type { Format } from "@zigshape/core";

export type Example = {
  id: string;
  label: string;
  /** Loading the example switches the input format to this. */
  format: Format;
  rootName: string;
  target: "plain" | "serde-zig";
  samples: string[];
};

export const EXAMPLES: Example[] = [
  {
    id: "user-camel",
    label: "User (camelCase API)",
    format: "json",
    rootName: "User",
    target: "serde-zig",
    samples: [
      `{
  "userId": 1,
  "firstName": "Alice",
  "email": "alice@example.com",
  "lastSeenAt": "2026-01-01T10:00:00Z"
}`,
      `{
  "userId": 2,
  "firstName": "Bob",
  "lastSeenAt": null
}`,
    ],
  },
  {
    id: "blog",
    label: "Nested + array of posts",
    format: "json",
    rootName: "Blog",
    target: "serde-zig",
    samples: [
      `{
  "name": "My blog",
  "owner": { "id": 1, "displayName": "Alice" },
  "posts": [
    { "id": 1, "title": "Hello", "tags": ["intro", "meta"] },
    { "id": 2, "title": "Second", "tags": [] }
  ]
}`,
    ],
  },
  {
    id: "config-kebab",
    label: "Config (kebab-case)",
    format: "json",
    rootName: "Cfg",
    target: "serde-zig",
    samples: [
      `{
  "server-port": 3000,
  "max-connections": 100,
  "log-level": "info",
  "feature-flags": {
    "experimental-router": true,
    "fast-path": false
  }
}`,
    ],
  },
  {
    id: "ids-map",
    label: "Dynamic-key map",
    format: "json",
    rootName: "Roster",
    target: "serde-zig",
    samples: [
      `{
  "u-1001": { "name": "Alice", "active": true },
  "u-1002": { "name": "Bob", "active": false },
  "u-1003": { "name": "Carol", "active": true },
  "u-1004": { "name": "Dave", "active": true }
}`,
    ],
  },
  {
    id: "github-user",
    label: "GitHub-like user payload",
    format: "json",
    rootName: "User",
    target: "serde-zig",
    samples: [
      `{
  "login": "octocat",
  "id": 1,
  "avatarUrl": "https://example.com/u/1.png",
  "type": "User",
  "siteAdmin": false,
  "name": "Octo Cat",
  "company": "GitHub",
  "blog": null,
  "publicRepos": 8
}`,
      `{
  "login": "ada",
  "id": 2,
  "avatarUrl": "https://example.com/u/2.png",
  "type": "User",
  "siteAdmin": false,
  "publicRepos": 0
}`,
    ],
  },
  {
    id: "stripe-invoice",
    label: "Stripe-like invoice",
    format: "json",
    rootName: "Invoice",
    target: "serde-zig",
    samples: [
      `{
  "id": "in_1Abcd",
  "object": "invoice",
  "amountDue": 1999,
  "amountPaid": 0,
  "currency": "usd",
  "status": "open",
  "lines": [
    { "id": "il_1", "amount": 1999, "description": "Pro plan" }
  ],
  "metadata": {}
}`,
    ],
  },
  {
    id: "k8s-deployment",
    label: "Kubernetes deployment",
    format: "yaml",
    rootName: "Deployment",
    target: "plain",
    samples: [
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ghcr.io/me/api:latest
          ports:
            - containerPort: 8080
`,
    ],
  },
  {
    id: "cargo-toml",
    label: "Cargo-like manifest",
    format: "toml",
    rootName: "Manifest",
    target: "plain",
    samples: [
      `[package]
name = "myapp"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1"
tokio = "1"

[features]
default = ["json"]
json = []
`,
    ],
  },
  {
    id: "rss-feed",
    label: "RSS feed",
    format: "xml",
    rootName: "Rss",
    target: "serde-zig",
    samples: [
      `<rss version="2.0">
  <channel>
    <title>Example feed</title>
    <link>https://example.com</link>
    <description>An example RSS channel</description>
    <item>
      <title>First post</title>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
    ],
  },
  {
    id: "soap-envelope",
    label: "SOAP envelope",
    format: "xml",
    rootName: "Envelope",
    target: "serde-zig",
    samples: [
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <auth:Credentials xmlns:auth="urn:auth">
      <auth:Token>abc123</auth:Token>
    </auth:Credentials>
  </soap:Header>
  <soap:Body>
    <m:GetUser xmlns:m="urn:users">
      <m:Id>42</m:Id>
    </m:GetUser>
  </soap:Body>
</soap:Envelope>`,
    ],
  },
  {
    id: "orders-csv",
    label: "Orders export (CSV)",
    format: "csv",
    rootName: "Order",
    target: "serde-zig",
    samples: [
      `id,customer,total,currency,paid,shipped_at
1001,Alice,49.90,EUR,true,2026-03-02
1002,"Bob, Jr.",12.5,USD,false,
1003,Carol,230,EUR,true,2026-03-04
`,
    ],
  },
  {
    id: "worker-zon",
    label: "Worker config (ZON)",
    format: "zon",
    rootName: "Config",
    target: "plain",
    samples: [
      `.{
    .name = "invoice-worker",
    .log_level = .info,
    .concurrency = 4,
    .queues = .{ "invoices", "receipts" },
    .database = .{
        .host = "localhost",
        .port = 5432,
        .pool_size = 8,
    },
}
`,
    ],
  },
  {
    id: "users-toon",
    label: "User list (TOON)",
    format: "toon",
    rootName: "Directory",
    target: "serde-zig",
    samples: [
      `users[3]{id,name,role,active}:
  1,Alice,admin,true
  2,Bob,editor,false
  3,Carol,viewer,true
page: 1
total: 3
`,
    ],
  },
];
