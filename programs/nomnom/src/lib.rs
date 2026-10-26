use anchor_lang::prelude::*;
use anchor_lang::system_program;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("7VDmuJyPxyKA9rzqoupukyLZJXGgbvzZpZPTb3AGFTNi");

pub const ARENA_SEED: &[u8] = b"arena";
pub const PLAYER_SEED: &[u8] = b"player";
pub const VAULT_SEED: &[u8] = b"vault";

pub const BASE_MASS: u64 = 500;
pub const WORLD_WIDTH: i32 = 4000;
pub const WORLD_HEIGHT: i32 = 4000;

#[ephemeral]
#[program]
pub mod nomnom {
    use super::*;

    /// Initialize the global game arena and treasury vault on Solana L1.
    pub fn initialize_arena(ctx: Context<InitializeArena>, min_deposit: u64) -> Result<()> {
        let arena = &mut ctx.accounts.arena;
        arena.admin = ctx.accounts.admin.key();
        arena.vault = ctx.accounts.vault.key();
        arena.total_players = 0;
        arena.min_deposit = min_deposit;
        arena.vault_bump = ctx.bumps.vault;
        arena.bump = ctx.bumps.arena;
        msg!("NomNom Arena initialized! Admin: {}", arena.admin);
        Ok(())
    }

    /// Spawn a player blob, deposit initial SOL equity into the arena vault.
    pub fn spawn_player(
        ctx: Context<SpawnPlayer>,
        name: String,
        deposit_amount: u64,
        color: u8,
        start_x: i32,
        start_y: i32,
    ) -> Result<()> {
        let arena = &mut ctx.accounts.arena;
        require!(
            deposit_amount >= arena.min_deposit,
            NomNomError::DepositTooLow
        );

        // Transfer SOL from player wallet to the Arena Vault
        if deposit_amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.player_signer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, deposit_amount)?;
        }

        let player = &mut ctx.accounts.player;
        player.authority = ctx.accounts.player_signer.key();
        player.arena = arena.key();

        // Copy up to 16 bytes for player name
        let mut name_bytes = [0u8; 16];
        let bytes = name.as_bytes();
        let len = bytes.len().min(16);
        name_bytes[..len].copy_from_slice(&bytes[..len]);
        player.name = name_bytes;

        player.x = start_x.clamp(50, WORLD_WIDTH - 50);
        player.y = start_y.clamp(50, WORLD_HEIGHT - 50);
        player.vx = 0;
        player.vy = 0;
        // 1 lamport per 50,000 corresponds to 1 extra mass point (0.01 SOL = +200 mass)
        player.mass = BASE_MASS + (deposit_amount / 50_000);
        player.score = 0;
        player.kills = 0;
        player.color = color;
        player.is_alive = true;
        player.deposit_lamports = deposit_amount;
        player.bump = ctx.bumps.player;

        arena.total_players = arena.total_players.saturating_add(1);
        msg!(
            "Player spawned: {} at ({}, {}) with mass {}",
            player.authority,
            player.x,
            player.y,
            player.mass
        );
        Ok(())
    }

    /// Delegate the player PDA to MagicBlock's Ephemeral Rollup validator.
    pub fn delegate_player(ctx: Context<DelegatePlayer>) -> Result<()> {
        let payer_key = ctx.accounts.payer.key();
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[PLAYER_SEED, payer_key.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        msg!("Player delegated to Ephemeral Rollup validator!");
        Ok(())
    }

    /// High-speed movement update executed on the Ephemeral Rollup (sub-20ms, zero gas).
    pub fn move_player(
        ctx: Context<MovePlayer>,
        new_x: i32,
        new_y: i32,
        vx: i16,
        vy: i16,
    ) -> Result<()> {
        let player = &mut ctx.accounts.player;
        require!(player.is_alive, NomNomError::PlayerEliminated);

        player.x = new_x.clamp(0, WORLD_WIDTH);
        player.y = new_y.clamp(0, WORLD_HEIGHT);
        player.vx = vx;
        player.vy = vy;
        Ok(())
    }

    /// Eat a food pellet on the Ephemeral Rollup to grow blob mass.
    pub fn eat_pellet(ctx: Context<EatPellet>, mass_gain: u32) -> Result<()> {
        let player = &mut ctx.accounts.player;
        require!(player.is_alive, NomNomError::PlayerEliminated);

        let gain = (mass_gain as u64).min(50); // cap single pellet gain
        player.mass = player.mass.saturating_add(gain);
        player.score = player.score.saturating_add(gain);
        Ok(())
    }

    /// Combat collision on ER: Predator absorbs victim's mass and equity!
    pub fn eat_player(ctx: Context<EatPlayer>) -> Result<()> {
        let predator = &mut ctx.accounts.predator;
        let victim = &mut ctx.accounts.victim;

        require!(predator.is_alive, NomNomError::PlayerEliminated);
        require!(victim.is_alive, NomNomError::VictimAlreadyDead);
        require!(
            predator.mass > (victim.mass * 11 / 10),
            NomNomError::InsufficientMassAdvantage
        );

        // Distance check
        let dx = (predator.x - victim.x) as i64;
        let dy = (predator.y - victim.y) as i64;
        let dist_sq = dx * dx + dy * dy;

        // Radius approximation: r = sqrt(mass) * 2
        // Collision threshold = predator_radius^2
        let predator_radius = (predator.mass as f64).sqrt() * 2.0;
        let max_dist_sq = (predator_radius * predator_radius) as i64;

        require!(dist_sq <= max_dist_sq, NomNomError::NotInEatingRange);

        // Predator absorbs victim's mass and lamport value!
        predator.mass = predator.mass.saturating_add(victim.mass);
        predator.deposit_lamports = predator
            .deposit_lamports
            .saturating_add(victim.deposit_lamports);
        predator.kills = predator.kills.saturating_add(1);
        predator.score = predator.score.saturating_add(victim.mass);

        // Victim is eliminated
        victim.is_alive = false;
        victim.mass = 0;
        victim.deposit_lamports = 0;

        msg!(
            "Combat! Predator {} absorbed victim {}",
            predator.authority,
            victim.authority
        );
        Ok(())
    }

    /// Commit the latest player state from ER to Solana base layer without undelegating.
    pub fn commit_player(ctx: Context<CommitPlayer>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.player.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Cash out: commits state and undelegates player account from ER back to Solana L1.
    pub fn cash_out_and_undelegate(ctx: Context<CashOut>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        msg!(
            "Player {} cashing out with mass {} and {} kills!",
            player.authority,
            player.mass,
            player.kills
        );
        player.exit(&crate::ID)?;

        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.player.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Claim SOL payout from the arena vault on Solana L1 after undelegation.
    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        let arena = &ctx.accounts.arena;

        require!(player.is_alive, NomNomError::PlayerEliminated);
        require!(player.deposit_lamports > 0, NomNomError::NoBalanceToClaim);

        let payout = player.deposit_lamports;
        let vault_balance = ctx.accounts.vault.lamports();
        let actual_payout = payout.min(vault_balance.saturating_sub(1_000_000)); // leave rent

        if actual_payout > 0 {
            let arena_key = arena.key();
            let vault_seeds = &[
                VAULT_SEED,
                arena_key.as_ref(),
                &[arena.vault_bump],
            ];
            let signer_seeds = &[&vault_seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.player_signer.to_account_info(),
                },
                signer_seeds,
            );
            system_program::transfer(cpi_ctx, actual_payout)?;
            msg!("Paid out {} lamports to {}", actual_payout, player.authority);
        }

        player.deposit_lamports = 0;
        player.is_alive = false;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeArena<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Arena::LEN,
        seeds = [ARENA_SEED],
        bump
    )]
    pub arena: Account<'info, Arena>,
    /// CHECK: Vault PDA to hold deposited SOL
    #[account(
        mut,
        seeds = [VAULT_SEED, arena.key().as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SpawnPlayer<'info> {
    #[account(
        mut,
        seeds = [ARENA_SEED],
        bump = arena.bump
    )]
    pub arena: Account<'info, Arena>,
    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED, arena.key().as_ref()],
        bump = arena.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    #[account(
        init,
        payer = player_signer,
        space = 8 + Player::LEN,
        seeds = [PLAYER_SEED, player_signer.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    #[account(mut)]
    pub player_signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePlayer<'info> {
    pub payer: Signer<'info>,
    /// CHECK: The player PDA to delegate
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct MovePlayer<'info> {
    #[account(
        mut,
        seeds = [PLAYER_SEED, player.authority.as_ref()],
        bump = player.bump
    )]
    pub player: Account<'info, Player>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EatPellet<'info> {
    #[account(
        mut,
        seeds = [PLAYER_SEED, player.authority.as_ref()],
        bump = player.bump
    )]
    pub player: Account<'info, Player>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EatPlayer<'info> {
    #[account(
        mut,
        seeds = [PLAYER_SEED, predator.authority.as_ref()],
        bump = predator.bump
    )]
    pub predator: Account<'info, Player>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, victim.authority.as_ref()],
        bump = victim.bump
    )]
    pub victim: Account<'info, Player>,
    pub authority: Signer<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitPlayer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, player.authority.as_ref()],
        bump = player.bump
    )]
    pub player: Account<'info, Player>,
}

#[commit]
#[derive(Accounts)]
pub struct CashOut<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, player.authority.as_ref()],
        bump = player.bump
    )]
    pub player: Account<'info, Player>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(
        seeds = [ARENA_SEED],
        bump = arena.bump
    )]
    pub arena: Account<'info, Arena>,
    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED, arena.key().as_ref()],
        bump = arena.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, player_signer.key().as_ref()],
        bump = player.bump
    )]
    pub player: Account<'info, Player>,
    #[account(mut)]
    pub player_signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Arena {
    pub admin: Pubkey,          // 32
    pub vault: Pubkey,          // 32
    pub total_players: u32,     // 4
    pub min_deposit: u64,       // 8
    pub vault_bump: u8,         // 1
    pub bump: u8,               // 1
}

impl Arena {
    pub const LEN: usize = 32 + 32 + 4 + 8 + 1 + 1;
}

#[account]
pub struct Player {
    pub authority: Pubkey,       // 32
    pub arena: Pubkey,           // 32
    pub name: [u8; 16],          // 16
    pub x: i32,                  // 4
    pub y: i32,                  // 4
    pub vx: i16,                 // 2
    pub vy: i16,                 // 2
    pub mass: u64,               // 8
    pub score: u64,              // 8
    pub kills: u32,              // 4
    pub color: u8,               // 1
    pub is_alive: bool,          // 1
    pub deposit_lamports: u64,   // 8
    pub bump: u8,                // 1
}

impl Player {
    pub const LEN: usize = 32 + 32 + 16 + 4 + 4 + 2 + 2 + 8 + 8 + 4 + 1 + 1 + 8 + 1;
}

#[error_code]
pub enum NomNomError {
    #[msg("Deposit amount is below the minimum required for the arena.")]
    DepositTooLow,
    #[msg("Player blob has already been eliminated.")]
    PlayerEliminated,
    #[msg("Victim blob is already dead.")]
    VictimAlreadyDead,
    #[msg("Predator must have at least 10% more mass to eat this blob.")]
    InsufficientMassAdvantage,
    #[msg("Target is outside eating collision range.")]
    NotInEatingRange,
    #[msg("No balance available to claim from this session.")]
    NoBalanceToClaim,
}
