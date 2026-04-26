pub const Users = []const User;

pub const User = struct {
    id: u64,
    name: []const u8,
};
