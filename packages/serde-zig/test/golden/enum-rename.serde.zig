const serde = @import("serde");

pub const Task = struct {
    state: State,
};

pub const State = enum {
    in_progress,
    done,
    on_hold,

    pub const serde = .{
        .rename_all = serde.NamingConvention.kebab_case,
    };
};
