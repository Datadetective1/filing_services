-- At most one pending payment per order. Sequential checkouts expire the previous
-- pending payment before creating a new one, so this never trips in normal use; it
-- stops concurrent checkout requests from creating (and paying) parallel sessions.
create unique index if not exists payments_one_pending_per_order
  on public.payments (order_id)
  where status = 'pending';
