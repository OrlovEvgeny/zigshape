const serde = @import("serde");

pub const User = struct {
    user_id: u8,
    user_profile: UserProfile,

    pub const serde = .{
        .rename_all = serde.NamingConvention.camel_case,
    };
};

pub const UserProfile = struct {
    display_name: []const u8,
    joined_at: []const u8,

    pub const serde = .{
        .rename_all = serde.NamingConvention.camel_case,
    };
};
