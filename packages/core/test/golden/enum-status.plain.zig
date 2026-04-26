pub const User = struct {
    id: u8,
    status: Status,
};

pub const Status = enum {
    active,
    inactive,
    pending,
};
