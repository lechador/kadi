/**
 * Generated from target/idl/kadi.json — do not edit by hand.
 * Regenerate with: npm run build:program
 */
export type Kadi = {
  "address": "GusBZT1xMiapNKnen2t67D86QcfQtGfyZvgRmR8hHKvR",
  "metadata": {
    "name": "kadi",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Non-custodial creator donations on Solana"
  },
  "instructions": [
    {
      "name": "claimSol",
      "discriminator": [
        139,
        113,
        179,
        189,
        190,
        30,
        132,
        195
      ],
      "accounts": [
        {
          "name": "goal",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "goal"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "claimToken",
      "discriminator": [
        116,
        206,
        27,
        191,
        166,
        19,
        0,
        73
      ],
      "accounts": [
        {
          "name": "goal",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "goal"
          ]
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "goal"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "createGoal",
      "discriminator": [
        229,
        63,
        42,
        239,
        1,
        226,
        219,
        196
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator.handle",
                "account": "Creator"
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "creator.goal_count",
                "account": "Creator"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Donations accumulate here rather than on the `goal` data account, so the",
            "claimable balance is never entangled with that account's rent."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "creator"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "target",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": {
            "option": "i64"
          }
        }
      ]
    },
    {
      "name": "createTokenGoal",
      "discriminator": [
        97,
        12,
        96,
        133,
        251,
        200,
        238,
        214
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator.handle",
                "account": "Creator"
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "creator.goal_count",
                "account": "Creator"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Still created for token goals: it owns the vault token account, so the",
            "vault address derivation stays identical across both goal kinds."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "creator"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "target",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": {
            "option": "i64"
          }
        }
      ]
    },
    {
      "name": "donateSol",
      "discriminator": [
        168,
        195,
        198,
        161,
        226,
        163,
        222,
        113
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "docs": [
            "cannot redirect the protocol fee to themselves."
          ],
          "writable": true
        },
        {
          "name": "supporter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  112,
                  112,
                  111,
                  114,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              },
              {
                "kind": "account",
                "path": "donor"
              }
            ]
          }
        },
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "message",
          "type": "string"
        }
      ]
    },
    {
      "name": "donateToken",
      "discriminator": [
        25,
        216,
        125,
        238,
        108,
        3,
        44,
        126
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "goal"
          ]
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "donorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "donor"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasury"
        },
        {
          "name": "treasuryTokenAccount",
          "docs": [
            "Created on first use for this mint; the donor covers the rent once and",
            "every later donation reuses it."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "account",
                "path": "token_program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "supporter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  112,
                  112,
                  111,
                  114,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              },
              {
                "kind": "account",
                "path": "donor"
              }
            ]
          }
        },
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "message",
          "type": "string"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "docs": [
            "every donation re-validates the passed treasury against this value."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "registerCreator",
      "discriminator": [
        85,
        3,
        194,
        210,
        164,
        140,
        160,
        195
      ],
      "accounts": [
        {
          "name": "creator",
          "docs": [
            "Seeded by the handle itself: uniqueness is enforced by the runtime (a",
            "second `init` at the same address fails) and `/c/<handle>` resolves to",
            "an address with no index or database."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "handle"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "handle",
          "type": "string"
        },
        {
          "name": "displayName",
          "type": "string"
        },
        {
          "name": "bio",
          "type": "string"
        },
        {
          "name": "avatarUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "setGoalStatus",
      "discriminator": [
        130,
        26,
        65,
        203,
        199,
        86,
        226,
        171
      ],
      "accounts": [
        {
          "name": "goal",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "goal"
          ]
        }
      ],
      "args": [
        {
          "name": "status",
          "type": {
            "defined": {
              "name": "goalStatus"
            }
          }
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "treasury",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "authority",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "updateCreator",
      "discriminator": [
        39,
        221,
        251,
        213,
        194,
        161,
        31,
        207
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "creator.handle",
                "account": "Creator"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "creator"
          ]
        }
      ],
      "args": [
        {
          "name": "displayName",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "bio",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "avatarUri",
          "type": {
            "option": "string"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "creator",
      "discriminator": [
        237,
        37,
        233,
        153,
        165,
        132,
        54,
        103
      ]
    },
    {
      "name": "goal",
      "discriminator": [
        163,
        66,
        166,
        245,
        130,
        131,
        207,
        26
      ]
    },
    {
      "name": "supporter",
      "discriminator": [
        198,
        125,
        73,
        94,
        72,
        40,
        233,
        159
      ]
    }
  ],
  "events": [
    {
      "name": "creatorRegistered",
      "discriminator": [
        171,
        154,
        9,
        10,
        48,
        130,
        186,
        128
      ]
    },
    {
      "name": "donationEvent",
      "discriminator": [
        43,
        125,
        2,
        48,
        193,
        140,
        25,
        191
      ]
    },
    {
      "name": "fundsClaimed",
      "discriminator": [
        202,
        115,
        101,
        227,
        91,
        111,
        239,
        217
      ]
    },
    {
      "name": "goalCreated",
      "discriminator": [
        40,
        74,
        205,
        224,
        20,
        51,
        92,
        239
      ]
    },
    {
      "name": "goalStatusChanged",
      "discriminator": [
        113,
        5,
        88,
        208,
        186,
        122,
        242,
        216
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidHandle",
      "msg": "Handle must be 3-32 characters of lowercase a-z, 0-9 or underscore"
    },
    {
      "code": 6001,
      "name": "displayNameTooLong",
      "msg": "Display name is too long"
    },
    {
      "code": 6002,
      "name": "bioTooLong",
      "msg": "Bio is too long"
    },
    {
      "code": 6003,
      "name": "uriTooLong",
      "msg": "URI is too long"
    },
    {
      "code": 6004,
      "name": "titleTooLong",
      "msg": "Goal title is too long"
    },
    {
      "code": 6005,
      "name": "descriptionTooLong",
      "msg": "Goal description is too long"
    },
    {
      "code": 6006,
      "name": "messageTooLong",
      "msg": "Donation message is too long"
    },
    {
      "code": 6007,
      "name": "titleEmpty",
      "msg": "Title cannot be empty"
    },
    {
      "code": 6008,
      "name": "feeTooHigh",
      "msg": "Protocol fee exceeds the hard ceiling of 10%"
    },
    {
      "code": 6009,
      "name": "invalidTarget",
      "msg": "Goal target must be greater than zero"
    },
    {
      "code": 6010,
      "name": "invalidDeadline",
      "msg": "Deadline must be in the future"
    },
    {
      "code": 6011,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6012,
      "name": "goalNotActive",
      "msg": "Goal is not accepting donations"
    },
    {
      "code": 6013,
      "name": "goalExpired",
      "msg": "Goal deadline has passed"
    },
    {
      "code": 6014,
      "name": "unauthorized",
      "msg": "Only the creator who owns this goal can do that"
    },
    {
      "code": 6015,
      "name": "insufficientFunds",
      "msg": "Requested amount exceeds the claimable balance"
    },
    {
      "code": 6016,
      "name": "notTokenGoal",
      "msg": "This goal is denominated in SOL"
    },
    {
      "code": 6017,
      "name": "notNativeGoal",
      "msg": "This goal is denominated in an SPL token"
    },
    {
      "code": 6018,
      "name": "mintMismatch",
      "msg": "Token mint does not match the goal's denomination"
    },
    {
      "code": 6019,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "config",
      "docs": [
        "Protocol singleton. Deliberately holds no counters: a global account that",
        "every donation had to write to would serialize the entire protocol behind a",
        "single write lock. Aggregate stats are derived client-side from",
        "`getProgramAccounts` instead."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "creator",
      "docs": [
        "A creator profile. The PDA is seeded by the handle itself, which makes",
        "handles globally unique for free and lets the frontend resolve",
        "`/c/<handle>` to an address with no index or database."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "handle",
            "type": "string"
          },
          {
            "name": "displayName",
            "type": "string"
          },
          {
            "name": "bio",
            "type": "string"
          },
          {
            "name": "avatarUri",
            "type": "string"
          },
          {
            "name": "goalCount",
            "docs": [
              "Monotonic counter used to derive the next goal PDA."
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "creatorRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "handle",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "donationEvent",
      "docs": [
        "Emitted on every donation. This is what the OBS overlay subscribes to — the",
        "donor's message rides along here rather than in an account, so it is",
        "permanent in the ledger and free to read, but costs no rent."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "donor",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "docs": [
              "`Pubkey::default()` for native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Gross amount, before the protocol fee."
            ],
            "type": "u64"
          },
          {
            "name": "net",
            "docs": [
              "Amount that actually landed in the vault."
            ],
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "message",
            "type": "string"
          },
          {
            "name": "raised",
            "docs": [
              "Goal total after this donation, for overlays that render a progress bar."
            ],
            "type": "u64"
          },
          {
            "name": "target",
            "type": "u64"
          },
          {
            "name": "isFirstTime",
            "docs": [
              "True when this donor had never given to this goal before."
            ],
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "fundsClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "goal",
      "docs": [
        "A fundraising goal. Donations for it accumulate in a separate vault PDA so",
        "that rent-exemption of this data account is never entangled with the",
        "claimable balance."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "docs": [
              "The `Creator` PDA this goal belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "owner",
            "docs": [
              "The creator's wallet, denormalised so `claim` needs one less account."
            ],
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "mint",
            "docs": [
              "`Pubkey::default()` means this goal is denominated in native SOL."
            ],
            "type": "pubkey"
          },
          {
            "name": "target",
            "type": "u64"
          },
          {
            "name": "raised",
            "docs": [
              "Gross total ever donated, in the goal's denomination. Never decremented,",
              "so the progress bar only ever moves forward even after a claim."
            ],
            "type": "u64"
          },
          {
            "name": "claimed",
            "docs": [
              "Cumulative amount withdrawn by the creator."
            ],
            "type": "u64"
          },
          {
            "name": "donationCount",
            "type": "u64"
          },
          {
            "name": "supporterCount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "goalStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "deadline",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "goalCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "target",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "goalStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "completed"
          },
          {
            "name": "archived"
          }
        ]
      }
    },
    {
      "name": "goalStatusChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "supporter",
      "docs": [
        "One account per unique (goal, donor) pair. Gives on-chain leaderboards with",
        "bounded growth — a repeat donor updates their existing account rather than",
        "creating a new receipt every time."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "donor",
            "type": "pubkey"
          },
          {
            "name": "total",
            "type": "u64"
          },
          {
            "name": "count",
            "type": "u64"
          },
          {
            "name": "firstDonatedAt",
            "type": "i64"
          },
          {
            "name": "lastDonatedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
