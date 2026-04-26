const serde = @import("serde");

pub const User = struct {
    user_id: u8,
    first_name: []const u8,
    email: ?[]const u8 = null,
    roles: []const []const u8,
    profile: Profile,

    pub const serde = .{
        .rename_all = serde.NamingConvention.camel_case,
    };
};

pub const Profile = struct {
    created_at: ?[]const u8 = null,
    active: bool,
};
