const serde = @import("serde");

pub const Thing = struct {
    first_name: []const u8,
    @"2fa_enabled": bool,

    pub const serde = .{
        .rename = .{
            .first_name = "first-name",
        },
    };
};
