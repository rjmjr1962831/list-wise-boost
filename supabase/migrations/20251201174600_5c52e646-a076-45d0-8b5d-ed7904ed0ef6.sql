CREATE POLICY anyone_can_view_city_pricing
ON arizona_city_pricing
FOR SELECT
USING (true);

CREATE POLICY admins_can_manage_city_pricing
ON arizona_city_pricing
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY anyone_can_view_subscriptions
ON agent_city_subscriptions
FOR SELECT
USING (true);

CREATE POLICY admins_can_manage_subscriptions
ON agent_city_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));