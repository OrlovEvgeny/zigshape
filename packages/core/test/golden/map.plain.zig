const std = @import("std");

pub const Cfg = std.StringHashMap(CfgValue);

pub const CfgValue = struct {
    v: u8,
};
