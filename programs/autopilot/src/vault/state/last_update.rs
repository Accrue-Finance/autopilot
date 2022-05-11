use anchor_lang::prelude::*;

use std::cmp::Ordering;

use crate::errors::AccrueError;


// Number of slots to consider stale after
pub const STALE_AFTER_SLOTS_ELAPSED: u64 = 1;

// Last update state
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)]
pub struct LastUpdate {
    // Last slot when updated
    slot: u64,  // private
    // True when marked stale, false when slot updated
    stale: bool,  // private
}

impl LastUpdate {
    pub fn size() -> i32 {
        8 + 1
    }

    // Create new last update
    pub fn new() -> Self {
        // Make sure all new LastUpdates have `stale = true` (re-initialization attacks)
        Self { slot: 0u64, stale: true }
    }

    // Return slots elapsed since given slot
    pub fn slots_elapsed(&self, slot: u64) -> Result<u64> {
        let slots_elapsed = slot
            .checked_sub(self.slot)
            .ok_or(AccrueError::OverflowError)?;
        Ok(slots_elapsed)
    }

    // Set last update slot
    pub fn update_slot(&mut self, slot: u64) {
        self.slot = slot;
        self.stale = false;
    }

    // Set stale to true
    pub fn mark_stale(&mut self) {
        self.stale = true;
    }

    // Check if marked stale or last update slot is too long ago
    pub fn is_stale(&self, slot: u64) -> Result<bool> {
        Ok(self.stale || self.slots_elapsed(slot)? >= STALE_AFTER_SLOTS_ELAPSED)
    }
}

impl PartialEq for LastUpdate {
    fn eq(&self, other: &Self) -> bool {
        self.slot == other.slot
    }
}

impl PartialOrd for LastUpdate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.slot.partial_cmp(&other.slot)
    }
}
