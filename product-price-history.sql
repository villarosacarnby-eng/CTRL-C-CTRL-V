
CREATE OR REPLACE FUNCTION public.price_on(
    p_product UUID,
    p_date DATE
)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT unit_price
    FROM public.product_prices
    WHERE product_id = p_product
      AND status = 'active'
      AND effective_date <= p_date
    ORDER BY effective_date DESC
    LIMIT 1;
$$;
