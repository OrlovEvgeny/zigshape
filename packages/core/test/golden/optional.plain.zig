const std = @import("std");

pub const User = struct {
    id: u8,
    email: ?std.json.Value = null,
};
