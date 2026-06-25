REVOKE EXECUTE ON FUNCTION public.execute_autonomous_db_repair(p_table TEXT, p_column TEXT, p_type TEXT) FROM PUBLIC, authenticated;

COMMENT ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) IS
    'Autonomous database repair helper. Restrictive access: Executable only by database administrators / service_role.';
