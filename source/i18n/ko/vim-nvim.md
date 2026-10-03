---
title: Vim Nvim
category: Tech
tag: Vim
date: 2025-09-20T16:02:35+08:00
---


# Vim-nvim

## Neovim이란?
**Neovim**<sup>[1]</sup>은 *Vim*의 포크 중 하나로, 코드베이스를 개선하여 API 구현을 더 쉽게 하고, 사용자 경험과 플러그인 구현을 향상시키는 것을 목표로 합니다.

Neovim(nvim)은 본질적으로 Vim을 현대화하고 비동기적이며 확장성이 뛰어난 버전으로 만든 것으로, 더 나은 플러그인 지원, IDE와 유사한 기능, 성능 개선, Lua 기반 설정을 위해 설계되었으며 대부분의 Vim 워크플로와의 호환성을 유지합니다.

| 기능 / 측면                       | Vim                      | Neovim                                                                |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| **비동기 플러그인**               | 제한적 / 블로킹          | 완전한 비동기, 논블로킹                                               |
| **언어 서버 프로토콜**            | 외부 플러그인만 가능     | 내장 LSP 클라이언트 (`vim.lsp`)                                       |
| **플러그인 언어 지원**            | Vimscript                | Vimscript + Lua + 모든 언어의 원격 플러그인 (Python, Ruby 등)         |
| **설정**                          | `vimrc` (Vimscript)      | `init.vim` (Vimscript) 또는 `init.lua` (Lua)                          |
| **내장 터미널**                   | 내장되지 않음            | 내장 터미널 (`:terminal`)                                             |
| **UI 아키텍처**                   | 모놀리식                 | 코어가 UI와 분리됨 → 외부 GUI 지원                                    |
| **성능 (동시성)**                 | 단일 스레드              | 이벤트 루프 + 비동기 작업 → 무거운 작업에서 더 부드러움               |
| **구문 강조 / 파싱**              | 정규식 기반              | Treesitter 통합 → 정확한 파싱, 폴딩, 강조                              |
| **커뮤니티 및 개발**              | 느린 업데이트, 안정적    | 활발한 개발, 현대적인 플러그인 생태계                                 |
| **하위 호환성**                   | Vimscript 완전 지원      | Vimscript 대부분 호환 + 새로운 API                                    |

다음은 Linux에서 nvim을 설치하는 방법입니다:
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

## neovim 설정
`nivm`은 `lua` 언어로 설정할 수 있습니다. 에디터, 키맵, 플러그인 등을 설정하기가 매우 쉽습니다.

다음은 간단한 설정 구조입니다:
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

각 `.lua` 파일을 살펴보겠습니다:
- `init.lua`: Neovim 설정 진입점, 이 파일을 계속 다시 로드합니다
- `lua`:
    - `lua/core`: 에디터 및 키바인딩 설정
        - `keymaps.lua`: 키바인딩 설정
        - `options.lua`: 에디터 설정
    - `lua/plugins`: 다양한 플러그인 설정
        - `completion.lua`: 코드 완성 플러그인
        - `git.lua`: git 기능 향상 플러그인
        - `init.lua`: `lazy`<sup>[2]</sup> 패키지 관리자 초기화
        - `lang.lua`: 언어 기능 향상 플러그인
        - `lsp.lua`: `nvim-lspconfig`<sup>[3]</sup> 플러그인 설정
        - `treesitter.lua`: `treesitter`<sup>[4]</sup> 플러그인 설정
        - `ui.lua`: 테마/상태 표시줄/파일 트리/버퍼 라인/커서 향상 설정
        - `utils.lua`: 기능 향상 플러그인, 예: `telescope`, `Comment`, `autopairs`, `dap`, `trouble` 등

> 모든 설정 파일은 저장소 [*iskyrainy/NvimConfig*](https://github.com/iskyrainy/NvimConfig)에서 관리됩니다.

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


링크:
[1]: [Neovim: hyperextensible Vim-based text editor](https://neovim.io/)
[2]: Neovim을 위한 현대적인 플러그인 관리자. 자세한 내용은 [lazy.nvim](https://github.com/folke/lazy.nvim) 참조
[3]: `nvim-lspconfig`는 Neovim LSP 클라이언트를 위한 설정 모음으로, 다양한 언어 서버에 대한 설정을 제공합니다. 자세한 내용은 [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) 참조
[4]: Neovim에서 구문 강조 및 언어별 기능을 지원합니다. 자세한 내용은 [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) 참조

기타:
- 더 많은 인기 플러그인은 [Trending](https://dotfyle.com/neovim/plugins/trending)을 참조하세요