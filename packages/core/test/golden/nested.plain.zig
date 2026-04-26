pub const User = struct {
    id: u64,
    profile: Profile,
};

pub const Profile = struct {
    city: []const u8,
    active: bool,
};
