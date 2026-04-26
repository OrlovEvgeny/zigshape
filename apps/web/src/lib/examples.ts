export type Example = {
  id: string;
  label: string;
  rootName: string;
  target: "plain" | "serde-zig";
  samples: string[];
};

export const EXAMPLES: Example[] = [
  {
    id: "user-camel",
    label: "User (camelCase API)",
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
];
