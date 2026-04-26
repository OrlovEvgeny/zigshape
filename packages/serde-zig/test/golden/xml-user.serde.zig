const serde = @import("serde");

pub const User = struct {
    name: []const u8,
    role: []const u8,
    id: u8,

    pub const serde = .{
        .xml_root = "user",
        .xml_attribute = .{ .id },
    };
};
