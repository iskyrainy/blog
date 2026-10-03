---
title: Vim Nvim
category: Tech
tag: Vim
date: 2025-09-20T16:02:35+08:00
---


# Vim-nvim

## Neovimとは？
**Neovim**<sup>[1]</sup> は *Vim* のフォークの一つであり、コードベースの改善、APIの実装の容易化、ユーザーエクスペリエンスとプラグイン実装の向上を目指しています。

Neovim（nvim）は本質的に、Vimを現代的で非同期かつ高度に拡張可能にしたバージョンであり、優れたプラグインサポート、IDEライクな機能、パフォーマンスの改善、Luaベースの設定を目的として設計されており、ほとんどのVimワークフローとの互換性を維持しています。

| 機能 / 側面                       | Vim                      | Neovim                                                                |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| **非同期プラグイン**              | 限定的 / ブロッキング    | 完全非同期、ノンブロッキング                                          |
| **Language Server Protocol**      | 外部プラグインのみ       | 組み込みLSPクライアント（`vim.lsp`）                                  |
| **プラグイン言語サポート**        | Vimscript                | Vimscript + Lua + 任意の言語によるリモートプラグイン（Python、Rubyなど） |
| **設定**                          | `vimrc`（Vimscript）     | `init.vim`（Vimscript）または `init.lua`（Lua）                       |
| **組み込みターミナル**            | なし                     | 組み込みターミナル（`:terminal`）                                     |
| **UIアーキテクチャ**              | モノリシック             | コアとUIを分離 → 外部GUIをサポート                                    |
| **パフォーマンス（並行処理）**    | シングルスレッド         | イベントループ + 非同期ジョブ → 重いタスクでもスムーズ                |
| **シンタックスハイライト / パース** | 正規表現ベース           | Treesitter統合 → 正確なパース、折りたたみ、ハイライト                 |
| **コミュニティと開発**            | 更新が遅い、安定         | 活発な開発、モダンなプラグインエコシステム                            |
| **後方互換性**                    | Vimscriptを完全サポート  | Vimscriptとの互換性が高い + 新しいAPI                                 |

以下はLinuxにnvimをインストールする方法です：
```bash
# change for your platform and arch
curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz
sudo rm -rf /opt/nvim-linux-x86_64
sudo tar -C /opt -xzf nvim-linux-x86_64.tar.gz
# export nvim bin to Path
echo "export PATH=\$PATH:/opt/nvim-linux-x86_64/bin" >> ~/.bashrc
source ~/.bashrc
rm -f nvim-linux-x86_64.tar.gz
```

## Neovimの設定
`nvim` は `lua` 言語で設定できます。エディタ、キーマップ、プラグインなどを設定するのはとても簡単です。

シンプルな設定構造は以下の通りです：
```bash
.
├── init.lua
├── lazy-lock.json
└── lua
    ├── core
    │   ├── keymaps.lua
    │   └── options.lua
    └── plugins
        ├── completion.lua
        ├── git.lua
        ├── init.lua
        ├── lang.lua
        ├── lsp.lua
        ├── treesitter.lua
        ├── ui.lua
        └── utils.lua
```

これらの `.lua` ファイルを見てみましょう：
- `init.lua`: Neovim設定のエントリーポイント。このファイルを再読み込みし続ける
- `lua`:
    - `lua/core`: エディタとキーバインドの設定
        - `keymaps.lua`: キーバインドの設定
        - `options.lua`: エディタの設定
    - `lua/plugins`: 各種プラグインの設定
        - `completion.lua`: コード補完プラグイン
        - `git.lua`: Git機能拡張プラグイン
        - `init.lua`: `lazy`<sup>[2]</sup> パッケージマネージャの初期化
        - `lang.lua`: 言語別機能拡張プラグイン
        - `lsp.lua`: `nvim-lspconfig`<sup>[3]</sup> プラグインの設定
        - `treesitter.lua`: `treesitter`<sup>[4]</sup> プラグインの設定
        - `ui.lua`: テーマ／ステータスライン／ファイルツリー／バッファライン／カーソル拡張の設定
        - `utils.lua`: 機能拡張プラグイン。例：`telescope`、`Comment`、`autopairs`、`dap`、`trouble` など

> すべての設定ファイルはリポジトリ [*iskyrainy/NvimConfig*](https://github.com/iskyrainy/NvimConfig) で管理されています。

### `init.lua`
```lua
-- base config
require("core.options")
require("core.keymaps")

-- plugins entrypoint
require("plugins")
```

### `lua/core/keymaps.lua`
```lua
vim.g.mapleader = ","
vim.g.maplocalleader = ","

local keymap = vim.keymap

-- ---------- insert mode ---------- ---
keymap.set("i", "jk", "<ESC>", { desc = "Exit insert mode" })

-- ---------- visual mode ---------- ---
keymap.set("v", "J", ":m '>+1<CR>gv=gv", { desc = "Move line down" })
keymap.set("v", "K", ":m '<-2<CR>gv=gv", { desc = "Move line up" })
vim.keymap.set("v", "<leader>y", '"+y', { desc = "Yank to system clipboard" })

-- ---------- normal mode ---------- ---
-- window
-- horizontally build a window
vim.keymap.set("n", "<leader>sh", "<C-w>s", { desc = "Split window horizontally" })

-- vertically build a window
vim.keymap.set("n", "<leader>sv", "<C-w>v", { desc = "Split window vertically" })

-- close this window
vim.keymap.set("n", "<leader>sc", "<C-w>c", { desc = "Close current window" })

-- close all of other windows
vim.keymap.set("n", "<leader>so", "<C-w>o", { desc = "Close other windows" })


-- switch window by: <leader> + h/j/k/l
vim.keymap.set("n", "<leader>h", "<C-w>h", { desc = "Move to left window" })
vim.keymap.set("n", "<leader>l", "<C-w>l", { desc = "Move to right window" })
vim.keymap.set("n", "<leader>j", "<C-w>j", { desc = "Move to bottom window" })
vim.keymap.set("n", "<leader>k", "<C-w>k", { desc = "Move to top window" })

-- adjust window size by: Alt + h/j/k/l
vim.keymap.set("n", "<A-l>", "<C-w><", { desc = "Decrease width" })
vim.keymap.set("n", "<A-h>", "<C-w>>", { desc = "Increase width" })
vim.keymap.set("n", "<A-j>", "<C-w>-", { desc = "Decrease height" })
vim.keymap.set("n", "<A-k>", "<C-w>+", { desc = "Increase height" })

-- split all windows
vim.keymap.set("n", "<leader>se", "<C-w>=", { desc = "Equalize window sizes" })


-- dispose highlighting
keymap.set("n", "<leader>nh", ":nohl<CR>", { desc = "Close highlighting" })

-- switch buffer
keymap.set("n", "<leader>q", ":bd<CR>", { desc = "Close current buffer" })
keymap.set("n", "<F7>", ":bprevious<CR>", { desc = "Move to previous buffer" })
keymap.set("n", "<F8>", ":bnext<CR>", { desc = "Move to next buffer" })

-- system clipboard
vim.keymap.set("n", "<leader>p", '"+p', { desc = "Paste from system clipboard" })
vim.keymap.set("n", "<leader>y", '"+yy', { desc = "Yank line to system clipboard" })

-- ---------- plugins ---------- ---
-- nvim-tree
vim.keymap.set("n", "<F4>", "<cmd>NvimTreeToggle<CR>", { noremap = true, silent = true }, { desc = "Open/Close file tree" })

-- treesitter
vim.keymap.set("n", "<leader>f", "gg=G", { desc = "Format code" })

-- lsp
vim.keymap.set("n", "ga", vim.diagnostic.open_float, { desc = "Open diagnostic info" })
vim.keymap.set("n", "gk", vim.diagnostic.goto_prev, { desc = "Move to previous diagnostic info" })
vim.keymap.set("n", "gj", vim.diagnostic.goto_next, { desc = "Move to next diagnostic info" })
vim.keymap.set("n", "gd", vim.lsp.buf.definition, { desc = "Jump to definition" })
vim.keymap.set("n", "gD", vim.lsp.buf.declaration, { desc = "Jump to declaration" })
vim.keymap.set("n", "gt", vim.lsp.buf.type_definition, { desc = "Jump to type_definition" })
vim.keymap.set("n", "gi", vim.lsp.buf.implementation, { desc = "Jump to implementation" })
vim.keymap.set("n", "gr", vim.lsp.buf.references, { desc = "Show all references" })
vim.keymap.set("n", "K", vim.lsp.buf.hover, { desc = "Show hover info" })
vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, {desc = "Rename var's name" } )
vim.keymap.set({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, { desc = "Code action" })
vim.keymap.set("n", "<leader>fm", function()
  vim.lsp.buf.format({ async = true })
end)

-- autocmd
-- auto reload rust-analyzer when Cargo.toml is changed
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = "Cargo.toml",
  callback = function()
    vim.lsp.buf.execute_command({ command = "rust-analyzer.reloadWorkspace" })
  end,
})

-- auto save file changes
vim.api.nvim_create_autocmd({ "InsertLeave", "TextChanged" }, {
  pattern = "*",
  callback = function()
    if vim.bo.modified then
      vim.cmd("silent! write")
    end
  end,
})
```

### `lua/core/options.lua`
```lua
local opt = vim.opt

-- line number
opt.relativenumber = true
opt.number = true

-- tab
opt.tabstop = 2
opt.shiftwidth = 2
opt.expandtab = true
opt.autoindent = true

-- not wrap
opt.wrap = false

-- cursor line
opt.cursorline = true

-- start mouse
opt.mouse:append("a")

-- system clipboard
-- need install `xclip`/`xsel` in Linux or `pbcopy`/`pbpaste` in MacOS
opt.clipboard:append("unnamedplus")

-- new window position
opt.splitright = true
opt.splitbelow = true

-- search
opt.ignorecase = true
opt.smartcase = true

-- theme
opt.termguicolors = true
opt.signcolumn = "yes"
```

### `lua/plugins/completion.lua`
```lua
return {
  { "hrsh7th/nvim-cmp", dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "L3MON4D3/LuaSnip",
    },
    config = function()
      local cmp = require("cmp")
      cmp.setup({
        snippet = { expand = function(args) require("luasnip").lsp_expand(args.body) end },
        mapping = cmp.mapping.preset.insert({
          ["<C-Space>"] = cmp.mapping.complete(),
          ["<CR>"] = cmp.mapping.confirm({ select = true }),
        }),
        sources = cmp.config.sources({
          { name = "nvim_lsp" },
          { name = "buffer" },
          { name = "path" },
        }),
      })
    end
  },
}
```

### `lua/plugins/git.lua`
```lua
return {
  { "lewis6991/gitsigns.nvim", config = function()
      require("gitsigns").setup()
    end
  },
  { "tpope/vim-fugitive" },
}
```

### `lua/plugins/init.lua`
```lua
-- lazy.nvim init
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  { import = "plugins.ui" },
  { import = "plugins.lsp" },
  { import = "plugins.completion" },
  { import = "plugins.treesitter" },
  { import = "plugins.git" },
  { import = "plugins.utils" },
  { import = "plugins.lang" },
})
```

### `lua/plugins/lang.lua`
```lua
return {
  { "simrat39/rust-tools.nvim", dependencies = "neovim/nvim-lspconfig",
    config = function()
      require("rust-tools").setup({})
    end
  },
  { "mfussenegger/nvim-jdtls" },
}
```

### `lua/plugins/lsp.lua`
```lua
return {
  -- Mason: LSP/DAP/tool installer
  {
    "williamboman/mason.nvim",
    build = ":MasonUpdate",
    config = function()
      require("mason").setup()
    end,
  },

  {
    "neovim/nvim-lspconfig",
    enable = function()
      -- config lsp servers that you need
      -- Lua
      vim.lsp.config('lua_ls', {})
      vim.lsp.enable('lua_ls')

      -- Python
      vim.lsp.config('pyright', {})
      vim.lsp.enable('pyright')

      -- Rust
      vim.lsp.config('rust_analyzer', {})
      vim.lsp.enable('rust_analyzer')
    end,
  },

  { "mfussenegger/nvim-jdtls" },
}
```

### `lua/plugins/treesitter.lua`
```lua
return {
  { "p00f/nvim-ts-rainbow" },
  { "nvim-treesitter/nvim-treesitter", branch = 'master', lazy = false, build = ":TSUpdate", config = function()
      require("nvim-treesitter.configs").setup({
        -- config languages that you need
        ensure_installed = { "lua", "python", "rust", "java", "json", "bash", "markdown", "markdown_inline" },
        highlight = { enable = true },
        indent = { enable = true },
      })
    end
  },
}
```

### `lua/plugins/ui.lua`
```lua
return {
  -- theme
  { "Mofiqul/vscode.nvim", config = function() vim.cmd.colorscheme "vscode" end },

  -- status line
  { "nvim-lualine/lualine.nvim", dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function() require("lualine").setup({ options = { theme = "vscode" } }) end
  },

  -- files tree
  { "nvim-tree/nvim-tree.lua", dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function() require("nvim-tree").setup() end
  },

  -- buffer line
  { "akinsho/bufferline.nvim", dependencies = "nvim-tree/nvim-web-devicons",
    config = function() require("bufferline").setup() end
  },

  -- cursor enhancements
  { "sphamba/smear-cursor.nvim",
    opts = {
      smear_between_buffers = true,
      smear_between_neighbor_lines = true,
      scroll_buffer_space = true,
      legacy_computing_symbols_support = true,
      smear_insert_mode = true,
    },
  },
  { "karb94/neoscroll.nvim", config = function() require("neoscroll").setup() end },
```

### `lua/plugins/utils.lua`
```lua
return {
  -- need install `ripgrep`/`fd` in system
  { "nvim-telescope/telescope.nvim", tag = "0.1.8", dependencies = { "nvim-lua/plenary.nvim" },
    config = function()
      local builtin = require('telescope.builtin')
      vim.keymap.set('n', '<leader>ff', builtin.find_files, { desc = 'Telescope find files' })
      vim.keymap.set('n', '<leader>fg', builtin.live_grep, { desc = 'Telescope live grep' })
      vim.keymap.set('n', '<leader>fb', builtin.buffers, { desc = 'Telescope buffers' })
      vim.keymap.set('n', '<leader>fh', builtin.help_tags, { desc = 'Telescope help tags' })
    end
  },
  { "numToStr/Comment.nvim", config = function() require("Comment").setup() end },
  { "windwp/nvim-autopairs", config = function() require("nvim-autopairs").setup() end },
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      -- your configuration comes here
      -- or leave it empty to use the default settings
      -- refer to the configuration section below
    },
    keys = {
      {
        "<leader>.",
        function()
          require("which-key").show({ global = false })
        end,
        desc = "Buffer Local Keymaps (which-key)",
      },
    },
  },
  { "rafamadriz/friendly-snippets" },
  {
    "folke/trouble.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      -- your configuration comes here
      -- or leave it empty to use the default settings
    },
    keys = {
      {
        "<leader>xx",
        "<cmd>Trouble diagnostics toggle<cr>",
        desc = "Diagnostics (Trouble)",
      },
      {
        "<leader>xX",
        "<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
        desc = "Buffer Diagnostics (Trouble)",
      },
      {
        "<leader>cs",
        "<cmd>Trouble symbols toggle focus=false<cr>",
        desc = "Symbols (Trouble)",
      },
      {
        "<leader>cl",
        "<cmd>Trouble lsp toggle focus=false win.position=right<cr>",
        desc = "LSP Definitions / references / ... (Trouble)",
      },
      {
        "<leader>xL",
        "<cmd>Trouble loclist toggle<cr>",
        desc = "Location List (Trouble)",
      },
      {
        "<leader>xQ",
        "<cmd>Trouble qflist toggle<cr>",
        desc = "Quickfix List (Trouble)",
      },
    },
  },
  { "mfussenegger/nvim-dap" },
}
```


リンク：
[1]: [Neovim: hyperextensible Vim-based text editor](https://neovim.io/)
[2]: Neovimのモダンなプラグインマネージャ。詳細は [lazy.nvim](https://github.com/folke/lazy.nvim) を参照
[3]: `nvim-lspconfig` はNeovim LSPクライアント用の設定のコレクションであり、さまざまな言語サーバーのセットアップを提供します。詳細は [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) を参照
[4]: Neovimにおけるシンタックスハイライトと言語固有機能のサポート。詳細は [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) を参照

その他：
- よりトレンドのプラグインは [Trending](https://dotfyle.com/neovim/plugins/trending) を参照