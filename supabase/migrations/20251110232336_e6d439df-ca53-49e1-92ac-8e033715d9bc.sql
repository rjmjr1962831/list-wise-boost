-- Function to automatically assign admin role to first user
create or replace function public.handle_first_user_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if there are any existing admin users
  if not exists (select 1 from public.user_roles where role = 'admin') then
    -- If no admins exist, make this user an admin
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin');
  end if;
  return new;
end;
$$;

-- Trigger to run the function when a new user signs up
create trigger on_auth_user_created_assign_first_admin
  after insert on auth.users
  for each row
  execute function public.handle_first_user_admin();