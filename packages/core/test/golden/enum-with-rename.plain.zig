pub const Task = struct {
    state: State,
};

pub const State = enum {
    in_progress,
    done,
    on_hold,
};
