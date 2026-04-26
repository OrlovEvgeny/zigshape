const serde = @import("serde");

pub const Cfg = struct {
    server_port: u64,
    max_connections: u64,
    log_level: []const u8,

    pub const serde = .{
        .rename_all = serde.NamingConvention.kebab_case,
    };
};
