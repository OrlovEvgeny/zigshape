const serde = @import("serde");

pub const User = struct {
    user_id: u64,
    first_name: []const u8,
    last_seen: []const u8,

    pub const serde = .{
        .rename_all = serde.NamingConvention.camel_case,
    };
};
