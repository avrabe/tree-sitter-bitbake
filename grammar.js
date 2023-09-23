/**
 * @file BitBake grammar for tree-sitter
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const {pythonCode, sep1} = require('./python');

module.exports = grammar({
  name: 'bitbake',

  conflicts: $ => [
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.list_splat_pattern],
    [$.tuple, $.tuple_pattern],
    [$.list, $.list_pattern],
    [$.with_item, $._collection_elements],
    [$.named_expression, $.as_pattern],
    [$.print_statement, $.primary_expression],
    [$.function_definition, $.primary_expression],
  ],

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent,
    $.string_start,
    $._string_content,
    $.escape_interpolation,
    $.string_end,

    // Mark comments as external tokens so that the external scanner is always
    // invoked, even if no external token is expected. This allows for better
    // error recovery, because the external scanner can maintain the overall
    // structure by returning dedent tokens whenever a dedent occurs, even
    // if no dedent is expected.
    $.comment,

    // Allow the external scanner to check for the validity of closing brackets
    // so that it can avoid returning dedent tokens between brackets.
    ']',
    ')',
    '}',
  ],

  extras: $ => [
    /\s/,
    $.comment,
  ],

  inline: $ => [
    $._simple_statement,
    $._compound_statement,
    $._suite,
    $._expressions,
    $._left_hand_side,
    $.keyword_identifier,
  ],

  supertypes: $ => [
    $._simple_statement,
    $._compound_statement,
    $.expression,
    $.primary_expression,
    $.pattern,
    $.parameter,
  ],

  rules: {
    recipe: $ => repeat(seq(
      choice(
        $.variable_assignment,
        $.unset_statement,
        $.inherit_directive,
        $.include_directive,
        $.require_directive,
        $.export_statement,
        $.overrides_statement,
        $.export_functions_statement,
        $.addtask_statement,
        $.deltask_statement,
        $.addhandler_statement,
        $.anonymous_python_function,
        $.function_definition,
        $.python_function_definition,
      ),
      choice(/\r?\n/, '\0'),
    )),

    variable_assignment: $ => seq(
      $.identifier,
      optional(choice(
        $.variable_flag,
        $.variable_expansion,
        $.override,
      )),
      field('operator',
        choice(
          '=',
          '?=',
          '??=',
          ':=',
          '+=',
          '=+',
          '.=',
          '=.',
        ),
      ),
      $.literal,
    ),
    variable_flag: $ => seq(
      '[',
      choice(
        alias($.identifier, $.flag),
        'noexec',
      ),
      ']',
    ),
    override: $ => seq(
      ':',
      sep1(choice('append', 'prepend', 'remove', $.identifier), ':'),
    ),

    unset_statement: $ => seq(
      'unset',
      $.identifier,
      optional($.variable_flag),
    ),

    inherit_directive: $ => seq(
      'inherit',
      repeat1(choice($.identifier, $.variable_expansion, $.inline_python)),
    ),

    inherit_configuration_directive: $ => seq(
      'INHERIT',
      '+=',
      '"',
      sep1($.identifier, ' '),
      '"',
    ),

    include_directive: $ => seq(
      'include',
      $.include_path,
      //alias(/[^ \r\n]+/, $.include_path),
    ),

    require_directive: $ => seq(
      'require',
      alias(/[^ \r\n]+/, $.include_path),
    ),

    include_path: $ =>  seq(
      repeat(
        choice(
          alias(/([a-z0-9A-Z-_/\.]+)/, $.include_path_content),
          $.variable_expansion
        )
      ),
      /[\r\n]+/,
    ),
      

    export_statement: $ => seq(
      'export',
      choice($.identifier, $.variable_assignment),
    ),

    overrides_statement: $ => seq(
      'OVERRIDES',
      '=',
      '"',
      sep1($.identifier, ':'),
      '"',
    ),

    export_functions_statement: $ => seq(
      'EXPORT_FUNCTIONS',
      repeat1($.identifier),
    ),

    addtask_statement: $ => seq(
      'addtask',
      $.identifier,
      optional(choice(
        seq(
          'after',
          repeat1($.identifier),
          'before',
          repeat1($.identifier),
        ),
        seq(
          'before',
          repeat1($.identifier),
          'after',
          repeat1($.identifier),
        ),
      )),
    ),

    deltask_statement: $ => seq(
      'deltask',
      $.identifier,
    ),

    addhandler_statement: $ => seq(
      'addhandler',
      $.identifier,
    ),

    anonymous_python_function: $ => seq(
      'python',
      optional(seq(
        $.identifier,
        optional($.override),
      )),
      '(',
      ')',
      '{',
      $._suite,
      '}',
    ),

    function_definition: $ => seq(
      $.identifier,
      optional($.override),
      '(',
      ')',
      '{',
      alias(/(?:({[^}]*})|[^}])*/, $.shell_content),
      '}',
    ),

    literal: $ => choice(
      $.string,
      // $.number,
      $.identifier,
    ),

    string: $ => choice(
      seq(
        '"',
        repeat(choice(
          alias(token.immediate(prec(1, /([^"$\\]|\\.?|\\?\r?\n)+/)), $.string_content),
          $.variable_expansion,
          $.inline_python,
          '$BB_ENV_PASSTHROUGH',
          '$BB_ENV_PASSTHROUGH_ADDITIONS',
        )),
        '"',
      ),
      seq(
        '\'',
        repeat(choice(
          alias(token.immediate(prec(1, /([^'$\\]|\\?\r?\n)+/)), $.string_content),
          $.variable_expansion,
          $.inline_python,
          '$BB_ENV_PASSTHROUGH',
          '$BB_ENV_PASSTHROUGH_ADDITIONS',
        )),
        '\'',
      ),
    ),

    inline_python: $ => seq('${@', $.expression, '}'),

    variable_expansion: $ => seq('${', $.identifier, '}'),

    identifier: _ => /[a-zA-Z0-9_-]+/,

    comment: _ => token(seq('#', /.*/)),

    ...pythonCode,
  },
});
