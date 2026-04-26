pub const Commands = []const Command;

pub const Command = union(enum) {
    ping: Ping,
    execute: Execute,
};

pub const Ping = struct {};

pub const Execute = struct {
    query: []const u8,
};
