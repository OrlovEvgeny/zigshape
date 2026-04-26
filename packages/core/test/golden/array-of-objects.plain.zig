pub const Root = struct {
    users: []const User,
};

pub const User = struct {
    id: u8,
    name: []const u8,
};
