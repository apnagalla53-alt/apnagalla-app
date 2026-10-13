-- Derived cost projections may be removed with their item only after authoritative
-- transaction foreign keys already permit removing that item (e.g. disposable tests).
ALTER TABLE inventory_cost_states DROP CONSTRAINT inventory_cost_states_item_id_fkey;
ALTER TABLE inventory_cost_states ADD CONSTRAINT inventory_cost_states_item_id_fkey
 FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE ON UPDATE CASCADE;
