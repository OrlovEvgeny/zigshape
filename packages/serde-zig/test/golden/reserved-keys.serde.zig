const serde = @import("serde");

pub const Thing = struct {
    type_: []const u8,
    pub_: []const u8,

    pub const serde = .{
        .rename = .{
            .type_ = "type",
            .pub_ = "pub",
        },
    };
};
