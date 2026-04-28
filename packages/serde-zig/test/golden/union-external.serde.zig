const serde = @import("serde");

pub const Commands = []const Command;

pub const Command = union(enum) {
    ping: Ping,
    execute: Execute,

    pub const serde = .{
        .tag = serde.UnionTag.external,
    };
};

pub const Ping = struct {};

pub const Execute = struct {
    query: []const u8,
};
