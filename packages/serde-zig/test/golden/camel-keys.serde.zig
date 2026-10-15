const serde = @import("serde");

pub const User = struct {
    user_id: u8,
    first_name: []const u8,
    last_seen: []const u8,

    pub const serde = .{
        .rename_all = .camel_case,
    };
};
