const std = @import("std");

pub const User = struct {
    id: u64,
    email: ?std.json.Value = null,
};
