; Rules added for C++ syntax not covered by nvim-treesitter's locals query.

(variadic_parameter_declaration
  declarator: (variadic_declarator
    (identifier) @local.definition.parameter))

(optional_parameter_declaration
  declarator: (identifier) @local.definition.parameter)

(structured_binding_declarator
  (identifier) @local.definition.var)

(lambda_capture_initializer
  left: (identifier) @local.definition.var)

(for_range_loop
  declarator: (identifier) @local.definition.var)

(for_range_loop
  declarator: (reference_declarator
    (identifier) @local.definition.var))
